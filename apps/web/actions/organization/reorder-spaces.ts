"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { spaceMembers, spaces } from "@cap/database/schema";
import type { Space } from "@cap/web-domain";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const LEVEL1_OWNERS = [
	"arnaud.lafosse@wallester.com",
	"dmitri.logvinenko@wallester.com",
	"sergei@wallester.com",
];

export async function reorderSpaces(
	orderedIds: string[],
	parentSpaceId: string | null,
) {
	const user = await getCurrentUser();
	if (!user) return { success: false, error: "Unauthorized" };

	const isLevel1 = parentSpaceId && !parentSpaceId.startsWith("space_");

	if (isLevel1 && !LEVEL1_OWNERS.includes(user.email || "")) {
		return {
			success: false,
			error: "Only admins can reorder top-level folders",
		};
	}

	try {
		if (!isLevel1 && orderedIds.length > 0) {
			const spaceRecords = await db()
				.select({
					id: spaces.id,
					createdById: spaces.createdById,
					privacy: spaces.privacy,
				})
				.from(spaces)
				.where(
					inArray(spaces.id, orderedIds as Space.SpaceIdOrOrganisationId[]),
				);

			for (const space of spaceRecords) {
				const isCreator = space.createdById === user.id;
				const isPublic = space.privacy === "Public";

				if (!isCreator && !isPublic) {
					const [membership] = await db()
						.select({ id: spaceMembers.id })
						.from(spaceMembers)
						.where(
							and(
								eq(spaceMembers.spaceId, space.id),
								eq(spaceMembers.userId, user.id),
							),
						)
						.limit(1);

					if (!membership) {
						return {
							success: false,
							error:
								"You don't have permission to reorder some of these folders",
						};
					}
				}
			}
		}

		for (let i = 0; i < orderedIds.length; i++) {
			const spaceId = orderedIds[i] as Space.SpaceIdOrOrganisationId;
			const displayOrder = i + 1;

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
