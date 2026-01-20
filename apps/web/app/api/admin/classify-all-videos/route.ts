/**
 * Admin Endpoint: Classify All Videos Retroactively
 *
 * POST /api/admin/classify-all-videos
 *
 * Classifies all videos that haven't been classified yet and have a complete transcription.
 * Assigns labels automatically based on AI suggestions.
 *
 * Security: Requires CRON_SECRET header (same as cleanup cron)
 *
 * Query params:
 * - dryRun=true: Preview what would be classified without making changes
 * - limit=N: Process only N videos (default: all)
 */

import { db } from "@cap/database";
import { s3Buckets, videos } from "@cap/database/schema";
import type { VideoMetadata } from "@cap/database/types";
import { serverEnv } from "@cap/env";
import { S3Buckets } from "@cap/web-backend";
import type { S3Bucket, Video } from "@cap/web-domain";
import { and, eq, isNull } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";
import {
	autoAssignLabels,
	classifyVideoLabels,
	seedSystemLabels,
} from "@/lib/classify-video-labels";
import { runPromise } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

interface ClassifyResult {
	processed: number;
	classified: number;
	skipped: number;
	errors: number;
	details: Array<{
		videoId: string;
		name: string;
		status: "classified" | "skipped" | "error";
		labels?: string[];
		ragEligibility?: string;
		error?: string;
	}>;
}

export async function POST(request: NextRequest) {
	// Verify admin secret
	const authHeader = request.headers.get("authorization");
	const cronSecret = serverEnv().CRON_SECRET;

	if (!cronSecret) {
		console.warn("[classify-all-videos] CRON_SECRET not configured");
		return Response.json(
			{ error: "Admin secret not configured" },
			{ status: 500 },
		);
	}

	if (authHeader !== `Bearer ${cronSecret}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const dryRun = searchParams.get("dryRun") === "true";
	const limitParam = searchParams.get("limit");
	const limit = limitParam ? parseInt(limitParam, 10) : undefined;

	console.log(
		`[classify-all-videos] Starting ${dryRun ? "DRY RUN" : "classification"}${limit ? ` (limit: ${limit})` : ""}`,
	);

	const result = await classifyAllVideos(dryRun, limit);

	console.log(
		`[classify-all-videos] Completed: ${result.classified} classified, ${result.skipped} skipped, ${result.errors} errors`,
	);

	return Response.json(result);
}

async function classifyAllVideos(
	dryRun: boolean,
	limit?: number,
): Promise<ClassifyResult> {
	const result: ClassifyResult = {
		processed: 0,
		classified: 0,
		skipped: 0,
		errors: 0,
		details: [],
	};

	// Find videos that need classification:
	// - aiClassifiedAt is null (not yet classified)
	// - transcriptionStatus is COMPLETE (has transcription in S3)
	let query = db()
		.select({
			video: videos,
			bucket: s3Buckets,
		})
		.from(videos)
		.leftJoin(s3Buckets, eq(videos.bucket, s3Buckets.id))
		.where(
			and(
				isNull(videos.aiClassifiedAt),
				eq(videos.transcriptionStatus, "COMPLETE"),
			),
		);

	if (limit) {
		query = query.limit(limit) as typeof query;
	}

	const unclassifiedVideos = await query;

	console.log(
		`[classify-all-videos] Found ${unclassifiedVideos.length} unclassified videos with transcription`,
	);

	for (const { video, bucket } of unclassifiedVideos) {
		result.processed++;

		try {
			if (dryRun) {
				// In dry run, just report what would be done
				result.classified++;
				result.details.push({
					videoId: video.id,
					name: video.name,
					status: "classified",
					labels: ["(dry run - not actually classified)"],
				});
				continue;
			}

			// Fetch transcription from S3
			const bucketId = (bucket?.id ?? null) as S3Bucket.S3BucketId | null;
			const transcription = await fetchTranscription(
				video.id as Video.VideoId,
				video.ownerId,
				bucketId,
			);

			if (!transcription || transcription.trim().length < 50) {
				result.skipped++;
				result.details.push({
					videoId: video.id,
					name: video.name,
					status: "skipped",
					error: "Transcription empty or too short",
				});
				continue;
			}

			// Ensure system labels exist for this organization
			await seedSystemLabels(video.orgId);

			// Get AI summary from metadata
			const metadata = (video.metadata as VideoMetadata) || {};

			// Classify the video
			const classification = await classifyVideoLabels(
				video.id as Video.VideoId,
				transcription,
				{
					aiSummary: metadata.summary ?? undefined,
					title: video.name,
					duration: video.duration ?? undefined,
				},
			);

			if (!classification.success) {
				result.errors++;
				result.details.push({
					videoId: video.id,
					name: video.name,
					status: "error",
					error: classification.error || "Classification failed",
				});
				continue;
			}

			// Auto-assign labels
			const { assigned } = await autoAssignLabels(
				video.id as Video.VideoId,
				video.orgId,
				classification,
				video.ownerId, // Use video owner as the assigner
			);

			result.classified++;
			result.details.push({
				videoId: video.id,
				name: video.name,
				status: "classified",
				labels: assigned,
				ragEligibility: classification.ragEligibility,
			});

			console.log(
				`[classify-all-videos] Classified "${video.name}": ${assigned.join(", ") || "no labels assigned"} (RAG: ${classification.ragEligibility})`,
			);
		} catch (error) {
			result.errors++;
			result.details.push({
				videoId: video.id,
				name: video.name,
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			console.error(
				`[classify-all-videos] Error classifying "${video.name}":`,
				error,
			);
		}
	}

	return result;
}

async function fetchTranscription(
	videoId: Video.VideoId,
	userId: string,
	bucketId: S3Bucket.S3BucketId | null,
): Promise<string | null> {
	try {
		const vtt = await Effect.gen(function* () {
			const [bucket] = yield* S3Buckets.getBucketAccess(
				Option.fromNullable(bucketId),
			);
			return yield* bucket.getObject(`${userId}/${videoId}/transcription.vtt`);
		}).pipe(runPromise);

		if (Option.isNone(vtt)) {
			return null;
		}

		// Extract text from VTT
		const lines = vtt.value.split("\n");
		const textLines: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			// Skip VTT headers, timestamps, and cue numbers
			if (
				trimmed &&
				trimmed !== "WEBVTT" &&
				!/^\d+$/.test(trimmed) &&
				!trimmed.includes("-->")
			) {
				textLines.push(trimmed);
			}
		}

		return textLines.join(" ");
	} catch (error) {
		console.error("[fetchTranscription] Error:", error);
		return null;
	}
}
