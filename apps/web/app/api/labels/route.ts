/**
 * Labels API
 *
 * GET /api/labels - List all labels for the current organization
 * POST /api/labels - Create a custom label
 */

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { videoLabels } from "@cap/database/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { nanoId } from "@cap/database/helpers";
import {
	seedSystemLabels,
	evaluateLabelForPromotion,
	promoteLabelToSystem,
} from "@/lib/classify-video-labels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const user = await getCurrentUser();

		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const orgId = user.activeOrganizationId;
		if (!orgId) {
			return Response.json(
				{ error: "No active organization" },
				{ status: 400 },
			);
		}

		// Ensure system labels exist
		await seedSystemLabels(orgId);

		// Fetch all active labels for the organization
		const labels = await db()
			.select()
			.from(videoLabels)
			.where(
				and(
					eq(videoLabels.organizationId, orgId),
					eq(videoLabels.isActive, true),
				),
			)
			.orderBy(videoLabels.category, videoLabels.displayName);

		return Response.json({ labels });
	} catch (error) {
		console.error("[labels GET] Error:", error);
		return Response.json(
			{ error: "Failed to fetch labels" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const user = await getCurrentUser();

		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const orgId = user.activeOrganizationId;
		if (!orgId) {
			return Response.json(
				{ error: "No active organization" },
				{ status: 400 },
			);
		}

		const body = await request.json();
		const { name, displayName, description, color, category, retentionDays } =
			body;

		if (!name || !displayName) {
			return Response.json(
				{ error: "Name and displayName are required" },
				{ status: 400 },
			);
		}

		// Validate name format (uppercase, underscores only)
		if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
			return Response.json(
				{
					error:
						"Name must be uppercase letters, numbers, and underscores only",
				},
				{ status: 400 },
			);
		}

		// Check if label with same name exists
		const existing = await db()
			.select()
			.from(videoLabels)
			.where(
				and(eq(videoLabels.organizationId, orgId), eq(videoLabels.name, name)),
			)
			.limit(1);

		if (existing.length > 0) {
			return Response.json(
				{ error: "A label with this name already exists" },
				{ status: 400 },
			);
		}

		// Create the label
		const id = nanoId();
		const labelCategory = category || "content_type";
		const labelColor = color || "#6B7280";
		const labelRetention = retentionDays || null;

		await db().insert(videoLabels).values({
			id: id as any,
			organizationId: orgId,
			name,
			displayName,
			description: description || null,
			color: labelColor,
			category: labelCategory,
			retentionDays: labelRetention,
			ragDefault: "pending",
			isSystem: false,
			isActive: true,
		});

		// Evaluate label for promotion to system labels (async, non-blocking)
		// This runs in the background and doesn't affect the response
		evaluateLabelForPromotion(
			name,
			displayName,
			description || null,
			labelCategory as "content_type" | "department",
		)
			.then((evaluation) => {
				if (evaluation.shouldPromote) {
					return promoteLabelToSystem(evaluation, labelColor, labelRetention);
				}
				return { promoted: false, reason: evaluation.reason };
			})
			.then((result) => {
				if (result.promoted) {
					console.log(`[labels POST] Label promoted: ${result.reason}`);
				} else {
					console.log(`[labels POST] Label not promoted: ${result.reason}`);
				}
			})
			.catch((error) => {
				console.error("[labels POST] Label evaluation error:", error);
			});

		return Response.json({
			success: true,
			label: { id, name, displayName },
		});
	} catch (error) {
		console.error("[labels POST] Error:", error);
		return Response.json(
			{ error: "Failed to create label" },
			{ status: 500 },
		);
	}
}
