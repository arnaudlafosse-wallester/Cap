import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { organizations } from "@cap/database/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getOrgAnalyticsData } from "@/app/(org)/dashboard/analytics/data";
import type { AnalyticsRange } from "@/app/(org)/dashboard/analytics/types";

const RANGE_VALUES: AnalyticsRange[] = ["24h", "7d", "30d", "lifetime"];

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const requestedOrgId = searchParams.get("orgId");
	const orgId = requestedOrgId ?? user.activeOrganizationId;
	const spaceId = searchParams.get("spaceId") ?? undefined;
	const capId = searchParams.get("capId") ?? undefined;

	if (!orgId)
		return Response.json({ error: "No active organization" }, { status: 400 });

	if (requestedOrgId && requestedOrgId !== user.activeOrganizationId) {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	// Check if user is the organization owner
	const org = await db()
		.select({ ownerId: organizations.ownerId })
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);

	const isOwner = org[0]?.ownerId === user.id;

	// Non-owners can only see their own analytics
	const filterByUserId = isOwner ? undefined : user.id;

	const rangeParam = (searchParams.get("range") ?? "7d") as AnalyticsRange;
	const range: AnalyticsRange = RANGE_VALUES.includes(rangeParam)
		? rangeParam
		: "7d";

	try {
		const data = await getOrgAnalyticsData(orgId, range, spaceId, capId, filterByUserId);
		return Response.json({ data, isOwner });
	} catch (error) {
		console.error("Failed to load analytics", error);
		return Response.json(
			{ error: "Failed to load analytics" },
			{ status: 500 },
		);
	}
}
