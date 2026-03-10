import { db } from "@cap/database";
import { s3Buckets, videos } from "@cap/database/schema";
import { S3Buckets } from "@cap/web-backend";
import type { Video } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";

import { runPromise } from "@/lib/server";
import { verifyWallyApiKey } from "../../auth";

export const dynamic = "force-dynamic";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ videoId: string }> },
) {
	if (!verifyWallyApiKey(request)) {
		return Response.json(
			{ error: true, message: "Invalid or missing API key" },
			{ status: 401 },
		);
	}

	const { videoId } = await params;
	if (!videoId) {
		return Response.json(
			{ error: true, message: "videoId not supplied" },
			{ status: 400 },
		);
	}

	const result = await db()
		.select({ video: videos, bucket: s3Buckets })
		.from(videos)
		.leftJoin(s3Buckets, eq(videos.bucket, s3Buckets.id))
		.where(eq(videos.id, videoId as Video.VideoId));

	if (result.length === 0 || !result[0]?.video) {
		return Response.json(
			{ error: true, message: "Video not found" },
			{ status: 404 },
		);
	}

	const video = result[0].video;
	const bucketRecord = result[0].bucket;

	if (video.transcriptionStatus !== "COMPLETE") {
		const status = video.transcriptionStatus || "UNKNOWN";
		const statusCode =
			status === "PROCESSING" ? 202 : status === "ERROR" ? 500 : 404;

		return Response.json(
			{
				error: true,
				message: `Transcription status: ${status}`,
				video_id: videoId,
				transcription_status: status,
			},
			{ status: statusCode },
		);
	}

	let transcriptVtt: string | null = null;
	try {
		const vttOption = await Effect.gen(function* () {
			const [bucket] = yield* S3Buckets.getBucketAccess(
				Option.fromNullable(bucketRecord?.id),
			);
			return yield* bucket.getObject(
				`${video.ownerId}/${videoId}/transcription.vtt`,
			);
		}).pipe(runPromise);

		if (Option.isSome(vttOption)) {
			transcriptVtt = vttOption.value;
		}
	} catch {
		return Response.json(
			{ error: true, message: "Failed to retrieve transcription file" },
			{ status: 500 },
		);
	}

	if (!transcriptVtt) {
		return Response.json(
			{ error: true, message: "Transcription file not found in storage" },
			{ status: 404 },
		);
	}

	const metadata = (video.metadata as Record<string, unknown>) || {};

	return Response.json(
		{
			video_id: videoId,
			title: video.name || (metadata.aiTitle as string) || "Untitled",
			duration: video.duration || null,
			transcription_status: "COMPLETE",
			transcript_vtt: transcriptVtt,
			metadata: {
				aiTitle: (metadata.aiTitle as string) || null,
				summary: (metadata.summary as string) || null,
				chapters: metadata.chapters || null,
			},
		},
		{ status: 200 },
	);
}
