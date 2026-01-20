/**
 * Cleanup Expired Videos Cron Job
 *
 * GET /api/cron/cleanup-expired-videos
 *
 * This endpoint should be called daily by an external cron service.
 * It deletes videos that have passed their retention date.
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access.
 *
 * Setup for Railway:
 * 1. Add CRON_SECRET to environment variables
 * 2. Create a cron job that calls this endpoint daily at 3 AM UTC:
 *    curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cleanup-expired-videos
 */

import { db } from "@cap/database";
import { s3Buckets, spaceVideos, comments, sharedVideos, videoLabelAssignments, videos } from "@cap/database/schema";
import { S3Buckets } from "@cap/web-backend";
import { serverEnv } from "@cap/env";
import type { S3Bucket, Video } from "@cap/web-domain";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";
import { runPromise } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for cleanup

interface CleanupResult {
	deleted: number;
	errors: number;
	details: Array<{
		videoId: string;
		name: string;
		expiresAt: Date;
		status: "deleted" | "error";
		error?: string;
	}>;
}

export async function GET(request: NextRequest) {
	// Verify cron secret
	const authHeader = request.headers.get("authorization");
	const cronSecret = serverEnv().CRON_SECRET;

	if (!cronSecret) {
		console.warn("[cleanup-expired-videos] CRON_SECRET not configured");
		return Response.json(
			{ error: "Cron secret not configured" },
			{ status: 500 },
		);
	}

	if (authHeader !== `Bearer ${cronSecret}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	console.log("[cleanup-expired-videos] Starting cleanup job");

	const result = await cleanupExpiredVideos();

	console.log(
		`[cleanup-expired-videos] Completed: ${result.deleted} deleted, ${result.errors} errors`,
	);

	return Response.json(result);
}

async function cleanupExpiredVideos(): Promise<CleanupResult> {
	const now = new Date();
	const result: CleanupResult = {
		deleted: 0,
		errors: 0,
		details: [],
	};

	// Find expired videos
	const expiredVideos = await db()
		.select({ video: videos, bucket: s3Buckets })
		.from(videos)
		.leftJoin(s3Buckets, eq(videos.bucket, s3Buckets.id))
		.where(
			and(
				isNotNull(videos.expiresAt),
				lte(videos.expiresAt, now),
				eq(videos.keepPermanently, false),
			),
		);

	console.log(`[cleanup-expired-videos] Found ${expiredVideos.length} expired videos`);

	for (const { video, bucket } of expiredVideos) {
		try {
			const videoId = video.id as Video.VideoId;
			const bucketId = (bucket?.id ?? null) as S3Bucket.S3BucketId | null;

			// Delete S3 files
			await deleteVideoFiles(videoId, video.ownerId, bucketId);

			// Delete related records (order matters due to foreign keys)
			// 1. Delete comments
			await db().delete(comments).where(eq(comments.videoId, videoId));

			// 2. Delete label assignments
			await db()
				.delete(videoLabelAssignments)
				.where(eq(videoLabelAssignments.videoId, videoId));

			// 3. Delete space videos (shares to spaces)
			await db().delete(spaceVideos).where(eq(spaceVideos.videoId, videoId));

			// 4. Delete shared videos
			await db().delete(sharedVideos).where(eq(sharedVideos.videoId, videoId));

			// 5. Finally delete the video
			await db().delete(videos).where(eq(videos.id, videoId));

			result.deleted++;
			result.details.push({
				videoId: video.id,
				name: video.name,
				expiresAt: video.expiresAt!,
				status: "deleted",
			});

			console.log(`[cleanup-expired-videos] Deleted video: ${video.id} (${video.name})`);
		} catch (error) {
			result.errors++;
			result.details.push({
				videoId: video.id,
				name: video.name,
				expiresAt: video.expiresAt!,
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			});

			console.error(
				`[cleanup-expired-videos] Error deleting video ${video.id}:`,
				error,
			);
		}
	}

	return result;
}

async function deleteVideoFiles(
	videoId: Video.VideoId,
	ownerId: string,
	bucketId: S3Bucket.S3BucketId | null,
): Promise<void> {
	const prefix = `${ownerId}/${videoId}/`;

	await Effect.gen(function* () {
		const [bucket] = yield* S3Buckets.getBucketAccess(
			Option.fromNullable(bucketId),
		);

		// List all objects with the video prefix
		const listedObjects = yield* bucket.listObjects({ prefix });

		// Delete all objects
		if (listedObjects.Contents && listedObjects.Contents.length > 0) {
			yield* bucket.deleteObjects(
				listedObjects.Contents.map((content) => ({ Key: content.Key })),
			);
			console.log(
				`[cleanup-expired-videos] Deleted ${listedObjects.Contents.length} S3 objects for ${videoId}`,
			);
		}
	}).pipe(
		Effect.catchAll((error) => {
			console.error(`[cleanup-expired-videos] S3 deletion error for ${videoId}:`, error);
			return Effect.succeed(undefined);
		}),
		runPromise,
	);
}
