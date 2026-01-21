/**
 * Video Labels API
 *
 * GET /api/videos/[videoId]/labels - Get labels assigned to a video
 * POST /api/videos/[videoId]/labels - Update video labels
 */

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { nanoId } from "@cap/database/helpers";
import {
	videoLabelAssignments,
	videoLabels,
	videos,
} from "@cap/database/schema";
import type { Video } from "@cap/web-domain";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { updateVideoExpiration } from "@/lib/classify-video-labels";

export const dynamic = "force-dynamic";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ videoId: string }> },
) {
	try {
		const user = await getCurrentUser();
		const { videoId } = await params;

		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Fetch video to check access
		const video = await db()
			.select()
			.from(videos)
			.where(eq(videos.id, videoId as Video.VideoId))
			.limit(1);

		if (!video[0]) {
			return Response.json({ error: "Video not found" }, { status: 404 });
		}

		// Fetch assigned labels
		const assignments = await db()
			.select({
				assignment: videoLabelAssignments,
				label: videoLabels,
			})
			.from(videoLabelAssignments)
			.innerJoin(videoLabels, eq(videoLabelAssignments.labelId, videoLabels.id))
			.where(eq(videoLabelAssignments.videoId, videoId as Video.VideoId));

		const labels = assignments.map((a) => ({
			id: a.label.id,
			name: a.label.name,
			displayName: a.label.displayName,
			color: a.label.color,
			category: a.label.category,
			retentionDays: a.label.retentionDays,
			isAiSuggested: a.assignment.isAiSuggested,
			aiConfidence: a.assignment.aiConfidence,
		}));

		return Response.json({
			labels,
			video: {
				id: video[0].id,
				ragStatus: video[0].ragStatus,
				expiresAt: video[0].expiresAt,
				keepPermanently: video[0].keepPermanently,
			},
		});
	} catch (error) {
		console.error("[video labels GET] Error:", error);
		return Response.json(
			{ error: "Failed to fetch video labels" },
			{ status: 500 },
		);
	}
}

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

		// Fetch video to check ownership
		const video = await db()
			.select()
			.from(videos)
			.where(eq(videos.id, videoId as Video.VideoId))
			.limit(1);

		if (!video[0]) {
			return Response.json({ error: "Video not found" }, { status: 404 });
		}

		if (video[0].ownerId !== user.id) {
			return Response.json(
				{ error: "Not authorized to modify this video" },
				{ status: 403 },
			);
		}

		const body = await request.json();
		const { labelIds, keepPermanently } = body as {
			labelIds: string[];
			keepPermanently?: boolean;
		};

		if (!Array.isArray(labelIds)) {
			return Response.json(
				{ error: "labelIds must be an array" },
				{ status: 400 },
			);
		}

		// Get current assignments
		const currentAssignments = await db()
			.select()
			.from(videoLabelAssignments)
			.where(eq(videoLabelAssignments.videoId, videoId as Video.VideoId));

		const currentLabelIds = currentAssignments.map((a) => a.labelId);

		// Determine labels to add and remove
		const labelsToAdd = labelIds.filter(
			(id) => !currentLabelIds.includes(id as any),
		);
		const labelsToRemove = currentLabelIds.filter(
			(id) => !labelIds.includes(id as string),
		);

		// Remove unselected labels
		if (labelsToRemove.length > 0) {
			await db()
				.delete(videoLabelAssignments)
				.where(
					and(
						eq(videoLabelAssignments.videoId, videoId as Video.VideoId),
						inArray(videoLabelAssignments.labelId, labelsToRemove),
					),
				);
		}

		// Add new labels
		if (labelsToAdd.length > 0) {
			const values = labelsToAdd.map((labelId) => ({
				id: nanoId(),
				videoId: videoId as Video.VideoId,
				labelId: labelId as any,
				assignedById: user.id,
				isAiSuggested: false,
				aiConfidence: null,
			}));

			await db().insert(videoLabelAssignments).values(values);
		}

		// Update keepPermanently if provided
		if (keepPermanently !== undefined) {
			await db()
				.update(videos)
				.set({ keepPermanently })
				.where(eq(videos.id, videoId as Video.VideoId));
		}

		// Recalculate expiration
		await updateVideoExpiration(videoId as Video.VideoId);

		// Fetch updated video
		const updatedVideo = await db()
			.select()
			.from(videos)
			.where(eq(videos.id, videoId as Video.VideoId))
			.limit(1);

		return Response.json({
			success: true,
			added: labelsToAdd.length,
			removed: labelsToRemove.length,
			expiresAt: updatedVideo[0]?.expiresAt,
			keepPermanently: updatedVideo[0]?.keepPermanently,
		});
	} catch (error) {
		console.error("[video labels POST] Error:", error);
		return Response.json(
			{ error: "Failed to update video labels" },
			{ status: 500 },
		);
	}
}
