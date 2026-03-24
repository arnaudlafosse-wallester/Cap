import { db } from "@cap/database";
import { videos } from "@cap/database/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { verifyWallyApiKey } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(
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

	let body: { name?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ error: true, message: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const { name } = body;
	if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
		return Response.json(
			{ error: true, message: "name is required (string, 1-255 chars)" },
			{ status: 400 },
		);
	}

	const trimmedName = name.trim();

	await db()
		.update(videos)
		.set({ name: trimmedName })
		.where(eq(videos.id, videoId));

	return Response.json({ success: true, video_id: videoId, name: trimmedName });
}
