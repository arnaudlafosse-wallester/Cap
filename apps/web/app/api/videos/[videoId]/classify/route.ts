/**
 * Video Classification API
 *
 * POST /api/videos/[videoId]/classify
 *
 * Triggers AI classification of a video to suggest labels and determine
 * RAG eligibility. Uses the video's transcription and AI summary.
 */

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { s3Buckets, videos } from "@cap/database/schema";
import type { VideoMetadata } from "@cap/database/types";
import { S3Buckets } from "@cap/web-backend";
import type { S3Bucket, Video } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";

import {
	autoAssignLabels,
	classifyVideoLabels,
	seedSystemLabels,
} from "@/lib/classify-video-labels";
import { runPromise } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ videoId: string }> },
) {
	try {
		const user = await getCurrentUser();
		const { videoId } = await params;

		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!videoId) {
			return Response.json({ error: "Video ID not provided" }, { status: 400 });
		}

		// Get video with bucket info
		const query = await db()
			.select({ video: videos, bucket: s3Buckets })
			.from(videos)
			.leftJoin(s3Buckets, eq(videos.bucket, s3Buckets.id))
			.where(eq(videos.id, videoId as Video.VideoId));

		if (query.length === 0 || !query[0]?.video) {
			return Response.json({ error: "Video not found" }, { status: 404 });
		}

		const { video, bucket } = query[0];

		// Check ownership
		if (video.ownerId !== user.id) {
			return Response.json(
				{ error: "Not authorized to classify this video" },
				{ status: 403 },
			);
		}

		// Check transcription status
		if (video.transcriptionStatus !== "COMPLETE") {
			return Response.json(
				{
					error: "Transcription not complete",
					transcriptionStatus: video.transcriptionStatus,
				},
				{ status: 400 },
			);
		}

		// Ensure system labels exist for this organization
		await seedSystemLabels(video.orgId);

		// Fetch transcription
		const bucketId = (bucket?.id ?? null) as S3Bucket.S3BucketId | null;
		const transcription = await fetchTranscription(
			videoId as Video.VideoId,
			video.ownerId,
			bucketId,
		);

		if (!transcription) {
			return Response.json(
				{ error: "Could not fetch transcription" },
				{ status: 400 },
			);
		}

		// Get AI summary from metadata
		const metadata = (video.metadata as VideoMetadata) || {};

		// Run classification
		const classification = await classifyVideoLabels(
			videoId as Video.VideoId,
			transcription,
			{
				title: video.name,
				duration: video.duration ?? undefined,
				aiSummary: metadata.summary ?? undefined,
			},
		);

		if (!classification.success) {
			return Response.json(
				{
					error: "Classification failed",
					details: classification.error,
				},
				{ status: 500 },
			);
		}

		// Auto-assign high-confidence labels
		const { assigned, skipped } = await autoAssignLabels(
			videoId as Video.VideoId,
			video.orgId,
			classification,
			user.id, // Use current user as assigner
		);

		return Response.json({
			success: true,
			classification: {
				labels: classification.labels,
				ragEligibility: classification.ragEligibility,
				reasoning: classification.reasoning,
			},
			autoAssigned: assigned,
			skipped: skipped,
		});
	} catch (error) {
		console.error("[classify] Unexpected error:", error);
		return Response.json(
			{ error: "An unexpected error occurred" },
			{ status: 500 },
		);
	}
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
