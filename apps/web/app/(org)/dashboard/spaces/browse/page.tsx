"use client";

import { Button, Input, Switch } from "@cap/ui";
import {
	faEdit,
	faLayerGroup,
	faPlus,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ChevronDown, ChevronRight, Search, GripVertical } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// Users who can manage level 1 folders (create, rename, delete, reorder)
const LEVEL1_OWNERS = [
	'arnaud.lafosse@wallester.com',
	'dmitri.logvinenko@wallester.com',
	'sergei@wallester.com',
];

import { deleteSpace } from "@/actions/organization/delete-space";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { ConfirmationDialog } from "../../_components/ConfirmationDialog";
import SpaceDialog from "../../_components/Navbar/SpaceDialog";
import { useDashboardContext } from "../../Contexts";
import type { Spaces } from "../../dashboard-data";

type SpaceWithDepth = Spaces & { depth: number; hasChildren: boolean; isShared: boolean };

export default function BrowseSpacesPage() {
	const { spacesData, user, activeOrganization } = useDashboardContext();

	// Check if current user can manage level 1 folders
	const isLevel1Owner = LEVEL1_OWNERS.includes(user?.email || '');

	const [showSpaceDialog, setShowSpaceDialog] = useState(false);
	const [editSpace, setEditSpace] = useState<any | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showShared, setShowShared] = useState(true);
	const [showPrivate, setShowPrivate] = useState(true);
	const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set());

	const toggleSpaceCollapse = (spaceId: string) => {
		setCollapsedSpaces(prev => {
			const next = new Set(prev);
			if (next.has(spaceId)) {
				next.delete(spaceId);
			} else {
				next.add(spaceId);
			}
			return next;
		});
	};

	const trueActiveOrgMembers = activeOrganization?.members.filter(
		(m) => m.user?.id !== user?.id,
	);

	// Build hierarchical structure with depth, hasChildren, and isShared flag
	const hierarchicalSpaces: SpaceWithDepth[] = useMemo(() => {
		if (!spacesData) return [];

		// Build children map and track which spaces have children
		const childrenByParent = new Map<string, Spaces[]>();
		const spacesWithChildrenSet = new Set<string>();

		for (const space of spacesData) {
			if (space.parentSpaceId) {
				const children = childrenByParent.get(space.parentSpaceId) || [];
				children.push(space);
				childrenByParent.set(space.parentSpaceId, children);
				spacesWithChildrenSet.add(space.parentSpaceId);
			}
		}

		// Find primary space (Shared) - we don't display it, but use it as root for shared spaces
		const primarySpace = spacesData.find(s => s.primary);
		const sharedSpaceIds = new Set<string>();
		if (primarySpace) {
			sharedSpaceIds.add(primarySpace.id);
		}

		// Recursively build tree with collapse support
		const buildTree = (parentId: string, depth: number, isShared: boolean, isParentCollapsed: boolean): SpaceWithDepth[] => {
			if (isParentCollapsed) return [];

			const children = childrenByParent.get(parentId) || [];
			const result: SpaceWithDepth[] = [];
			for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
				const hasChildren = spacesWithChildrenSet.has(child.id);
				const isCollapsed = collapsedSpaces.has(child.id);
				result.push({ ...child, depth, hasChildren, isShared });
				if (isShared) sharedSpaceIds.add(child.id);
				result.push(...buildTree(child.id, depth + 1, isShared, isCollapsed));
			}
			return result;
		};

		const result: SpaceWithDepth[] = [];

		// SHARED section: Children of primary space directly (without showing "Shared" itself)
		if (primarySpace) {
			const directChildren = childrenByParent.get(primarySpace.id) || [];
			for (const child of directChildren.sort((a, b) => a.name.localeCompare(b.name))) {
				const hasChildren = spacesWithChildrenSet.has(child.id);
				const isCollapsed = collapsedSpaces.has(child.id);
				result.push({ ...child, depth: 0, hasChildren, isShared: true });
				sharedSpaceIds.add(child.id);
				result.push(...buildTree(child.id, 1, true, isCollapsed));
			}
		}

		// PRIVATE section: top-level spaces not under Shared
		const topLevelPrivate = spacesData.filter(s =>
			!s.primary && !s.parentSpaceId && !sharedSpaceIds.has(s.id)
		).sort((a, b) => a.name.localeCompare(b.name));

		for (const space of topLevelPrivate) {
			const hasChildren = spacesWithChildrenSet.has(space.id);
			const isCollapsed = collapsedSpaces.has(space.id);
			result.push({ ...space, depth: 0, hasChildren, isShared: false });
			result.push(...buildTree(space.id, 1, false, isCollapsed));
		}

		return result;
	}, [spacesData, collapsedSpaces]);

	// Apply search and type filters
	const filteredSpaces = useMemo(() => {
		return hierarchicalSpaces.filter((space: SpaceWithDepth) => {
			// Search filter
			if (searchQuery && !space.name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			// Type filter
			if (space.isShared && !showShared) return false;
			if (!space.isShared && !showPrivate) return false;
			return true;
		});
	}, [hierarchicalSpaces, searchQuery, showShared, showPrivate]);
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
				toast.success("Folder deleted successfully");
				router.refresh();
				if (params.spaceId === pendingDeleteSpace.id) {
					router.push("/dashboard");
				}
			} else {
				toast.error(result.error || "Failed to delete folder");
			}
		} catch (error) {
			console.error("Error deleting space:", error);
			toast.error("Failed to delete folder");
		} finally {
			setRemoving(false);
			setConfirmOpen(false);
			setPendingDeleteSpace(null);
		}
	};

	return (
		<>
			<div className="flex flex-wrap gap-3 justify-between items-start w-full">
				<div className="flex flex-wrap gap-3 items-center">
					<Button
						onClick={() => setShowSpaceDialog(true)}
						size="sm"
						variant="dark"
					>
						<FontAwesomeIcon className="size-3" icon={faPlus} />
						Create Folder
					</Button>
					{/* Type filter toggles */}
					<div className="flex gap-4 items-center ml-4">
						<label className="flex gap-2 items-center cursor-pointer">
							<Switch
								checked={showShared}
								onCheckedChange={setShowShared}
								className="data-[state=checked]:bg-green-600"
							/>
							<span className="text-sm text-gray-11">Shared</span>
						</label>
						<label className="flex gap-2 items-center cursor-pointer">
							<Switch
								checked={showPrivate}
								onCheckedChange={setShowPrivate}
								className="data-[state=checked]:bg-blue-500"
							/>
							<span className="text-sm text-gray-11">Private</span>
						</label>
					</div>
				</div>
				<div className="flex relative w-full max-w-md">
					<div className="flex absolute inset-y-0 left-3 items-center pointer-events-none">
						<Search className="size-4 text-gray-9" />
					</div>
					<Input
						type="text"
						placeholder="Search folders..."
						className="flex-1 pr-3 pl-8 w-full min-w-full text-sm placeholder-gray-8"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>
			<div className="overflow-x-auto rounded-xl border border-gray-3 mt-6">
				<table className="min-w-full bg-gray-1">
					<thead>
						<tr className="text-sm text-left text-gray-10">
							<th className="px-6 py-3 font-medium">Name</th>
							<th className="px-6 py-3 font-medium">Type</th>
							<th className="px-6 py-3 font-medium">Videos</th>
							<th className="px-6 py-3 font-medium">Role</th>
							<th className="px-6 py-3 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{!spacesData && (
							<tr>
								<td colSpan={5} className="px-6 py-6 text-center text-gray-8">
									Loading Spaces…
								</td>
							</tr>
						)}
						{spacesData && filteredSpaces && filteredSpaces.length === 0 && (
							<tr>
								<td colSpan={5} className="px-6 py-6 text-center text-gray-8">
									No folders found.
								</td>
							</tr>
						)}
						{filteredSpaces?.map((space: SpaceWithDepth) => {
							const indentPadding = space.depth * 24; // 24px per level
							const isCollapsed = collapsedSpaces.has(space.id);
							return (
								<tr
									key={space.id}
									onClick={() => router.push(`/dashboard/spaces/${space.id}`)}
									className="border-t transition-colors cursor-pointer hover:bg-gray-2 border-gray-3"
								>
									<td className="px-6 py-4">
										<div
											className="flex gap-2 items-center"
											style={{ paddingLeft: `${indentPadding}px` }}
										>
											{/* Drag handle - visible for users who can reorder this folder */}
											{(() => {
												const isLevel1Folder = space.depth === 0;
												const canReorder = !space.primary && (
													isLevel1Folder ? isLevel1Owner : (space.createdById === user?.id)
												);
												return canReorder ? (
													<div
														className="flex justify-center items-center rounded hover:bg-gray-4 size-6 flex-shrink-0 cursor-grab active:cursor-grabbing"
														onClick={(e) => e.stopPropagation()}
														title="Drag to reorder"
													>
														<GripVertical size={14} className="text-gray-8" />
													</div>
												) : (
													<div className="size-6 flex-shrink-0" />
												);
											})()}
											{/* Collapse/expand chevron for spaces with children */}
											{space.hasChildren ? (
												<div
													onClick={(e) => {
														e.stopPropagation();
														toggleSpaceCollapse(space.id);
													}}
													className="flex justify-center items-center rounded hover:bg-gray-4 size-6 flex-shrink-0 cursor-pointer"
												>
													{isCollapsed ? (
														<ChevronRight size={16} className="text-gray-10" />
													) : (
														<ChevronDown size={16} className="text-gray-10" />
													)}
												</div>
											) : (
												<div className="size-6 flex-shrink-0" />
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
											space.isShared
												? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
												: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
										}`}>
											{space.isShared ? "Shared" : "Private"}
										</span>
									</td>
									<td className="px-6 py-4 text-sm text-gray-12">
										{space.videoCount} video
										{space.videoCount === 1 ? "" : "s"}
									</td>
									<td className="px-6 py-4 text-sm text-gray-12">
										{space.createdById === user?.id ? "Admin" : "Member"}
									</td>
									<td className="px-6">
										{(() => {
											// Permission logic:
											// - Level 1 folders (depth === 0): only LEVEL1_OWNERS can manage
											// - Level 2+ folders (depth > 0): creator can manage
											const isLevel1Folder = space.depth === 0;
											const canManage = !space.primary && (
												isLevel1Folder ? isLevel1Owner : (space.createdById === user?.id)
											);

											return canManage ? (
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
													<p>—</p>
												</div>
											);
										})()}
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
				title="Delete folder"
				description={(() => {
					if (!pendingDeleteSpace) {
						return "Are you sure you want to delete this folder? This action cannot be undone.";
					}

					// Count subfolders under this space
					const countSubfolders = (parentId: string): number => {
						const children = spacesData?.filter(s => s.parentSpaceId === parentId) || [];
						let count = children.length;
						for (const child of children) {
							count += countSubfolders(child.id);
						}
						return count;
					};

					// Count total videos (including in subfolders)
					const countTotalVideos = (parentId: string): number => {
						const space = spacesData?.find(s => s.id === parentId);
						let count = space?.videoCount || 0;
						const children = spacesData?.filter(s => s.parentSpaceId === parentId) || [];
						for (const child of children) {
							count += countTotalVideos(child.id);
						}
						return count;
					};

					const subfolderCount = countSubfolders(pendingDeleteSpace.id);
					const totalVideos = countTotalVideos(pendingDeleteSpace.id);

					let warningParts: string[] = [];
					if (subfolderCount > 0) {
						warningParts.push(`${subfolderCount} subfolder${subfolderCount > 1 ? 's' : ''}`);
					}
					if (totalVideos > 0) {
						warningParts.push(`${totalVideos} video${totalVideos > 1 ? 's' : ''}`);
					}

					const contentWarning = warningParts.length > 0
						? `\n\nThis folder contains ${warningParts.join(' and ')} that will be permanently deleted.`
						: '';

					return `Are you sure you want to delete the folder "${pendingDeleteSpace.name}"?${contentWarning}\n\nThis action cannot be undone.`;
				})()}
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
