"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { videos } from "@cap/database/schema";
import { serverEnv } from "@cap/env";
import { S3Buckets } from "@cap/web-backend";
import type { Video } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { Effect, Option } from "effect";
import { runPromise } from "@/lib/server";

export async function regenerateThumbnail({
	videoId,
}: {
	videoId: Video.VideoId;
}): Promise<{ success: boolean; regenerated: boolean }> {
	const user = await getCurrentUser();
	if (!user) throw new Error("Unauthorized");

	const [video] = await db()
		.select()
		.from(videos)
		.where(eq(videos.id, videoId));

	if (!video) return { success: false, regenerated: false };
	if (video.ownerId !== user.id) throw new Error("Unauthorized");

	const thumbnailKey = `${video.ownerId}/${video.id}/screenshot/screen-capture.jpg`;
	const videoKey = `${video.ownerId}/${video.id}/result.mp4`;

	const [bucket] = await S3Buckets.getBucketAccess(
		Option.fromNullable(video.bucket),
	).pipe(runPromise);

	const thumbnailExists = await bucket
		.headObject(thumbnailKey)
		.pipe(
			Effect.map(() => true),
			Effect.catchAll(() => Effect.succeed(false)),
		)
		.pipe(runPromise);

	if (thumbnailExists) return { success: true, regenerated: false };

	const mediaServerUrl = serverEnv().MEDIA_SERVER_URL;
	if (!mediaServerUrl) return { success: false, regenerated: false };

	const videoUrl = await bucket
		.getInternalSignedObjectUrl(videoKey)
		.pipe(runPromise);

	const response = await fetch(`${mediaServerUrl}/video/thumbnail`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ videoUrl }),
	});

	if (!response.ok) return { success: false, regenerated: false };

	const jpegBuffer = new Uint8Array(await response.arrayBuffer());

	await bucket
		.putObject(thumbnailKey, jpegBuffer, { contentType: "image/jpeg" })
		.pipe(runPromise);

	return { success: true, regenerated: true };
}
