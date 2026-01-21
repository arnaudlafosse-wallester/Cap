import { promises as fs } from "node:fs";
import { db } from "@cap/database";
import { organizations, s3Buckets, videos } from "@cap/database/schema";
import { serverEnv } from "@cap/env";
import { S3Buckets } from "@cap/web-backend";
import type { S3Bucket, Video } from "@cap/web-domain";
import { createClient } from "@deepgram/sdk";
import { eq } from "drizzle-orm";
import { Option } from "effect";
import { checkHasAudioTrack, extractAudioFromUrl } from "@/lib/audio-extract";
import {
	checkHasAudioTrackViaMediaServer,
	extractAudioViaMediaServer,
	isMediaServerConfigured,
} from "@/lib/media-client";
import { runPromise } from "@/lib/server";
import { type DeepgramResult, formatToWebVTT } from "@/lib/transcribe-utils";

type TranscribeResult = {
	success: boolean;
	message: string;
};

export async function transcribeVideo(
	videoId: Video.VideoId,
	userId: string,
	aiGenerationEnabled = false,
	_isRetry = false,
): Promise<TranscribeResult> {
	if (!serverEnv().DEEPGRAM_API_KEY) {
		return {
			success: false,
			message: "Missing necessary environment variables",
		};
	}

	if (!userId || !videoId) {
		return {
			success: false,
			message: "userId or videoId not supplied",
		};
	}

	const query = await db()
		.select({
			video: videos,
			bucket: s3Buckets,
			settings: videos.settings,
			orgSettings: organizations.settings,
		})
		.from(videos)
		.leftJoin(s3Buckets, eq(videos.bucket, s3Buckets.id))
		.leftJoin(organizations, eq(videos.orgId, organizations.id))
		.where(eq(videos.id, videoId));

	if (query.length === 0) {
		return { success: false, message: "Video does not exist" };
	}

	const result = query[0];
	if (!result || !result.video) {
		return { success: false, message: "Video information is missing" };
	}

	const { video } = result;

	if (!video) {
		return { success: false, message: "Video information is missing" };
	}

	if (
		video.settings?.disableTranscript ??
		result.orgSettings?.disableTranscript
	) {
		console.log(
			`[transcribeVideo] Transcription disabled for video ${videoId}`,
		);
		try {
			await db()
				.update(videos)
				.set({ transcriptionStatus: "SKIPPED" })
				.where(eq(videos.id, videoId));
		} catch (err) {
			console.error(`[transcribeVideo] Failed to mark as skipped:`, err);
			return {
				success: false,
				message: "Transcription disabled, but failed to update status",
			};
		}
		return {
			success: true,
			message: "Transcription disabled for video — skipping transcription",
		};
	}

	if (
		video.transcriptionStatus === "COMPLETE" ||
		video.transcriptionStatus === "PROCESSING" ||
		video.transcriptionStatus === "SKIPPED" ||
		video.transcriptionStatus === "NO_AUDIO"
	) {
		return {
			success: true,
			message: "Transcription already completed or in progress",
		};
	}

	try {
		console.log(
			`[transcribeVideo] Starting direct transcription for video ${videoId}`,
		);

		// Mark as processing
		await db()
			.update(videos)
			.set({ transcriptionStatus: "PROCESSING" })
			.where(eq(videos.id, videoId));

		// Get bucket access
		const [bucket] = await S3Buckets.getBucketAccess(
			Option.fromNullable(result.bucket?.id as S3Bucket.S3BucketId | null),
		).pipe(runPromise);

		// Get video URL
		const videoKey = `${userId}/${videoId}/result.mp4`;
		const videoUrl = await bucket.getSignedObjectUrl(videoKey).pipe(runPromise);

		// Check if video is accessible
		const response = await fetch(videoUrl, {
			method: "GET",
			headers: { range: "bytes=0-0" },
		});
		if (!response.ok) {
			throw new Error("Video file not accessible");
		}

		// Extract audio (via Media Server or locally)
		const useMediaServer = isMediaServerConfigured();
		let hasAudio: boolean;
		let audioBuffer: Buffer;

		console.log(`[transcribeVideo] Using media server: ${useMediaServer}`);

		if (useMediaServer) {
			hasAudio = await checkHasAudioTrackViaMediaServer(videoUrl);
			if (!hasAudio) {
				await db()
					.update(videos)
					.set({ transcriptionStatus: "NO_AUDIO" })
					.where(eq(videos.id, videoId));
				return { success: true, message: "Video has no audio track" };
			}
			audioBuffer = await extractAudioViaMediaServer(videoUrl);
		} else {
			hasAudio = await checkHasAudioTrack(videoUrl);
			if (!hasAudio) {
				await db()
					.update(videos)
					.set({ transcriptionStatus: "NO_AUDIO" })
					.where(eq(videos.id, videoId));
				return { success: true, message: "Video has no audio track" };
			}
			const extractResult = await extractAudioFromUrl(videoUrl);
			try {
				audioBuffer = await fs.readFile(extractResult.filePath);
			} finally {
				await extractResult.cleanup();
			}
		}

		// Upload temp audio to S3
		const audioKey = `${userId}/${videoId}/audio-temp.mp3`;
		await bucket
			.putObject(audioKey, audioBuffer, { contentType: "audio/mpeg" })
			.pipe(runPromise);

		const audioSignedUrl = await bucket
			.getSignedObjectUrl(audioKey)
			.pipe(runPromise);

		// Transcribe with Deepgram
		console.log(`[transcribeVideo] Calling Deepgram for video ${videoId}`);
		const deepgram = createClient(serverEnv().DEEPGRAM_API_KEY as string);

		const { result: dgResult, error: dgError } =
			await deepgram.listen.prerecorded.transcribeUrl(
				{ url: audioSignedUrl },
				{
					model: "nova-3",
					smart_format: true,
					detect_language: true,
					utterances: true,
					mime_type: "audio/mpeg",
				},
			);

		if (dgError) {
			throw new Error(`Deepgram transcription failed: ${dgError.message}`);
		}

		const transcription = formatToWebVTT(dgResult as unknown as DeepgramResult);

		// Save transcription to S3
		await bucket
			.putObject(`${userId}/${videoId}/transcription.vtt`, transcription, {
				contentType: "text/vtt",
			})
			.pipe(runPromise);

		// Mark as complete
		await db()
			.update(videos)
			.set({ transcriptionStatus: "COMPLETE" })
			.where(eq(videos.id, videoId));

		// Cleanup temp audio
		try {
			await bucket.deleteObject(audioKey).pipe(runPromise);
		} catch {}

		console.log(
			`[transcribeVideo] Transcription completed for video ${videoId}`,
		);

		return {
			success: true,
			message: "Transcription completed",
		};
	} catch (error) {
		console.error("[transcribeVideo] Failed:", error);

		await db()
			.update(videos)
			.set({ transcriptionStatus: null })
			.where(eq(videos.id, videoId));

		return {
			success: false,
			message: `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}
