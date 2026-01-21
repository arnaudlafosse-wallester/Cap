"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { spaces } from "@cap/database/schema";
import { Space } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Users who can manage level 1 folders (create, rename, delete, reorder)
const LEVEL1_OWNERS = [
	'arnaud.lafosse@wallester.com',
	'dmitri.logvinenko@wallester.com',
	'sergei@wallester.com',
];

export async function reorderSpaces(
	orderedIds: string[],
	parentSpaceId: string | null
) {
	const user = await getCurrentUser();
	if (!user) return { success: false, error: "Unauthorized" };

	// For level 1 folders (parentSpaceId is the organizationId), check if user is LEVEL1_OWNER
	// For deeper levels, any member can reorder their own folders
	const isLevel1 = parentSpaceId && !parentSpaceId.startsWith("space_");

	if (isLevel1 && !LEVEL1_OWNERS.includes(user.email || '')) {
		return { success: false, error: "Only admins can reorder top-level folders" };
	}

	try {
		// Update displayOrder for each space
		for (let i = 0; i < orderedIds.length; i++) {
			const spaceId = orderedIds[i] as Space.SpaceIdOrOrganisationId;
			const displayOrder = i + 1; // 1-based ordering

			// For non-level1, verify the user has permission (is creator)
			if (!isLevel1) {
				const [space] = await db()
					.select({ createdById: spaces.createdById })
					.from(spaces)
					.where(eq(spaces.id, spaceId))
					.limit(1);

				if (!space || space.createdById !== user.id) {
					// Skip spaces the user doesn't own
					continue;
				}
			}

			await db()
				.update(spaces)
				.set({ displayOrder })
				.where(eq(spaces.id, spaceId));
		}

		revalidatePath("/dashboard");
		revalidatePath("/dashboard/spaces/browse");
		return { success: true };
	} catch (error) {
		console.error("Error reordering spaces:", error);
		return { success: false, error: "Failed to reorder folders" };
	}
}
