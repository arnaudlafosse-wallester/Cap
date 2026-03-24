import { db } from "@cap/database";
import { videos } from "@cap/database/schema";
import { and, eq, like } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { verifyWallyApiKey } from "../../auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	if (!verifyWallyApiKey(request)) {
		return Response.json(
			{ error: true, message: "Invalid or missing API key" },
			{ status: 401 },
		);
	}

	const result = await db()
		.select({
			id: videos.id,
			name: videos.name,
			createdAt: videos.createdAt,
		})
		.from(videos)
		.where(
			and(
				like(videos.name, "Cap 20%"),
				eq(videos.transcriptionStatus, "COMPLETE"),
			),
		)
		.limit(10);

	return Response.json({ videos: result });
}
