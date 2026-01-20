"use client";

import { Button, Input } from "@cap/ui";
import {
	faEdit,
	faLayerGroup,
	faPlus,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteSpace } from "@/actions/organization/delete-space";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { ConfirmationDialog } from "../../_components/ConfirmationDialog";
import SpaceDialog from "../../_components/Navbar/SpaceDialog";
import { useDashboardContext } from "../../Contexts";
import type { Spaces } from "../../dashboard-data";

type SpaceWithDepth = Spaces & { depth: number };

export default function BrowseSpacesPage() {
	const { spacesData, user, activeOrganization } = useDashboardContext();
	const [showSpaceDialog, setShowSpaceDialog] = useState(false);
	const [editSpace, setEditSpace] = useState<any | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const trueActiveOrgMembers = activeOrganization?.members.filter(
		(m) => m.user?.id !== user?.id,
	);

	// Build hierarchical structure with depth
	const hierarchicalSpaces: SpaceWithDepth[] = (() => {
		if (!spacesData) return [];

		// Build children map
		const childrenByParent = new Map<string, Spaces[]>();
		for (const space of spacesData) {
			if (space.parentSpaceId) {
				const children = childrenByParent.get(space.parentSpaceId) || [];
				children.push(space);
				childrenByParent.set(space.parentSpaceId, children);
			}
		}

		// Recursively build tree
		const buildTree = (parentId: string, depth: number): SpaceWithDepth[] => {
			const children = childrenByParent.get(parentId) || [];
			const result: SpaceWithDepth[] = [];
			for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
				result.push({ ...child, depth });
				result.push(...buildTree(child.id, depth + 1));
			}
			return result;
		};

		// Find primary space (Shared) and build from there
		const primarySpace = spacesData.find(s => s.primary);
		const result: SpaceWithDepth[] = [];

		if (primarySpace) {
			result.push({ ...primarySpace, depth: 0 });
			result.push(...buildTree(primarySpace.id, 1));
		}

		// Add top-level non-primary spaces (Private spaces)
		const topLevelPrivate = spacesData.filter(s =>
			!s.primary && !s.parentSpaceId
		).sort((a, b) => a.name.localeCompare(b.name));

		for (const space of topLevelPrivate) {
			result.push({ ...space, depth: 0 });
			result.push(...buildTree(space.id, 1));
		}

		return result;
	})();

	const filteredSpaces = hierarchicalSpaces.filter((space: SpaceWithDepth) =>
		space.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);
	const router = useRouter();
	const params = useParams();

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingDeleteSpace, setPendingDeleteSpace] = useState<Spaces | null>(
		null,
	);
	const [removing, setRemoving] = useState(false);

	const handleDeleteSpace = (e: React.MouseEvent, space: Spaces) => {
		e.preventDefault();
		e.stopPropagation();
		setPendingDeleteSpace(space);
		setConfirmOpen(true);
	};

	const confirmRemoveSpace = async () => {
		if (!pendingDeleteSpace) return;
		setRemoving(true);
		try {
			const result = await deleteSpace(pendingDeleteSpace.id);
			if (result.success) {
				toast.success("Space deleted successfully");
				router.refresh();
				if (params.spaceId === pendingDeleteSpace.id) {
					router.push("/dashboard");
				}
			} else {
				toast.error(result.error || "Failed to delete space");
			}
		} catch (error) {
			console.error("Error deleting space:", error);
			toast.error("Failed to delete space");
		} finally {
			setRemoving(false);
			setConfirmOpen(false);
			setPendingDeleteSpace(null);
		}
	};

	return (
		<>
			<div className="flex flex-wrap gap-3 justify-between items-start w-full">
				<Button
					onClick={() => setShowSpaceDialog(true)}
					size="sm"
					variant="dark"
				>
					<FontAwesomeIcon className="size-3" icon={faPlus} />
					Create Space
				</Button>
				<div className="flex relative w-full max-w-md">
					<div className="flex absolute inset-y-0 left-3 items-center pointer-events-none">
						<Search className="size-4 text-gray-9" />
					</div>
					<Input
						type="text"
						placeholder="Search spaces..."
						className="flex-1 pr-3 pl-8 w-full min-w-full text-sm placeholder-gray-8"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>
			<div className="overflow-x-auto rounded-xl border border-gray-3">
				<table className="min-w-full bg-gray-1">
					<thead>
						<tr className="text-sm text-left text-gray-10">
							<th className="px-6 py-3 font-medium">Name</th>
							<th className="px-6 py-3 font-medium">Type</th>
							<th className="px-6 py-3 font-medium">Members</th>
							<th className="px-6 py-3 font-medium">Videos</th>
							<th className="px-6 py-3 font-medium">Role</th>
							<th className="px-6 py-3 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{!spacesData && (
							<tr>
								<td colSpan={6} className="px-6 py-6 text-center text-gray-8">
									Loading Spaces…
								</td>
							</tr>
						)}
						{spacesData && filteredSpaces && filteredSpaces.length === 0 && (
							<tr>
								<td colSpan={6} className="px-6 py-6 text-center text-gray-8">
									No spaces found.
								</td>
							</tr>
						)}
						{filteredSpaces?.map((space: SpaceWithDepth) => {
							const indentPadding = space.depth * 24; // 24px per level
							return (
								<tr
									key={space.id}
									onClick={() => router.push(`/dashboard/spaces/${space.id}`)}
									className="border-t transition-colors cursor-pointer hover:bg-gray-2 border-gray-3"
								>
									<td className="px-6 py-4">
										<div
											className="flex gap-3 items-center"
											style={{ paddingLeft: `${indentPadding}px` }}
										>
											{space.depth > 0 && (
												<span className="text-gray-6 mr-1">└</span>
											)}
											<SignedImageUrl
												image={space.iconUrl}
												name={space.name}
												className="relative flex-shrink-0 size-7"
												letterClass="text-sm"
											/>
											<span className="text-sm font-semibold text-gray-12">
												{space.name}
											</span>
										</div>
									</td>
									<td className="px-6 py-4">
										<span className={`text-xs px-2 py-1 rounded-full ${
											space.privacy === "Public"
												? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
												: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
										}`}>
											{space.privacy}
										</span>
									</td>
									<td className="px-6 py-4 text-sm text-gray-12">
										{space.memberCount} member
										{space.memberCount === 1 ? "" : "s"}
									</td>
									<td className="px-6 py-4 text-sm text-gray-12">
										{space.videoCount} video
										{space.videoCount === 1 ? "" : "s"}
									</td>
									<td className="px-6 py-4 text-sm text-gray-12">
										{space.createdById === user?.id ? "Admin" : "Member"}
									</td>
									<td className="px-6">
										{space.createdById === user?.id && !space.primary ? (
											<div className="flex gap-2">
												<Button
													variant="gray"
													className="size-8 p-0 min-w-[unset]"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														setEditSpace({
															id: space.id,
															name: space.name,
															members: (trueActiveOrgMembers || []).map(
																(m: { user: { id: string } }) => m.user.id,
															),
															iconUrl: space.iconUrl,
															privacy: space.privacy as "Public" | "Private",
															parentSpaceId: space.parentSpaceId,
														});
														setShowSpaceDialog(true);
													}}
												>
													<FontAwesomeIcon icon={faEdit} className="size-3" />
												</Button>
												<Button
													variant="gray"
													onClick={(e) => handleDeleteSpace(e, space)}
													className="size-8 p-0 min-w-[unset]"
													size="sm"
												>
													<FontAwesomeIcon icon={faTrash} className="size-3" />
												</Button>
											</div>
										) : (
											<div className="h-8 text-gray-10">
												<p>...</p>
											</div>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<SpaceDialog
				open={showSpaceDialog}
				onClose={() => {
					setShowSpaceDialog(false);
					setEditSpace(null);
				}}
				edit={!!editSpace}
				space={editSpace}
				onSpaceUpdated={() => {
					setShowSpaceDialog(false);
					setEditSpace(null);
					router.refresh();
				}}
			/>
			<ConfirmationDialog
				open={confirmOpen}
				icon={<FontAwesomeIcon icon={faLayerGroup} />}
				title="Delete space"
				description={
					pendingDeleteSpace
						? `Are you sure you want to delete the space "${pendingDeleteSpace?.name || "selected"}"? This action cannot be undone.`
						: "Are you sure you want to delete this space? This action cannot be undone."
				}
				confirmLabel={removing ? "Deleting..." : "Delete"}
				cancelLabel="Cancel"
				loading={removing}
				onConfirm={confirmRemoveSpace}
				onCancel={() => {
					setConfirmOpen(false);
					setPendingDeleteSpace(null);
				}}
			/>
		</>
	);
}
