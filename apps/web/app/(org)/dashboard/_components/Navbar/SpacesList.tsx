"use client";

import { Button } from "@cap/ui";
import type { Space } from "@cap/web-domain";
import {
	faLayerGroup,
	faPlus,
	faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { shareCap } from "@/actions/caps/share";
import { deleteSpace } from "@/actions/organization/delete-space";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { Tooltip } from "@/components/Tooltip";
import { useDashboardContext } from "../../Contexts";
import type { Spaces } from "../../dashboard-data";
import { LayersIcon } from "../AnimatedIcons";
import type { LayersIconHandle } from "../AnimatedIcons/Layers";
import { ConfirmationDialog } from "../ConfirmationDialog";
import SpaceDialog from "./SpaceDialog";

const SpacesList = ({ toggleMobileNav }: { toggleMobileNav?: () => void }) => {
	const { spacesData, sidebarCollapsed, user } = useDashboardContext();
	const [showSpaceDialog, setShowSpaceDialog] = useState(false);
	const [showAllSpaces, setShowAllSpaces] = useState(false);
	const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);
	const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(
		new Set(),
	);
	const router = useRouter();
	const params = useParams();
	const pathname = usePathname();
	const layersIconRef = useRef<LayersIconHandle>(null);

	const toggleSpaceCollapse = (spaceId: string) => {
		setCollapsedSpaces((prev) => {
			const next = new Set(prev);
			if (next.has(spaceId)) {
				next.delete(spaceId);
			} else {
				next.add(spaceId);
			}
			return next;
		});
	};

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

	if (!spacesData) return null;

	// Build hierarchical structure with multi-level support and SHARED/PRIVATE sections
	type SpaceWithDepth = Spaces & {
		depth: number;
		hasChildren: boolean;
		isLastChild: boolean;
	};

	const {
		sharedSpaces,
		privateSpaces,
		hasMoreShared,
		hiddenSharedCount,
		hasMorePrivate,
		hiddenPrivateCount,
		spacesWithChildren,
	} = useMemo(() => {
		// Build children map for quick lookup
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

		// Recursively build tree with depth, respecting collapsed state
		const buildTree = (
			parentId: string,
			depth: number,
			isParentCollapsed: boolean,
		): SpaceWithDepth[] => {
			if (isParentCollapsed) return [];

			const children = childrenByParent.get(parentId) || [];
			const result: SpaceWithDepth[] = [];
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (!child) continue;
				const hasChildren = spacesWithChildrenSet.has(child.id);
				const isCollapsed = collapsedSpaces.has(child.id);
				const isLastChild = i === children.length - 1;
				result.push({ ...child, depth, hasChildren, isLastChild });
				result.push(...buildTree(child.id, depth + 1, isCollapsed));
			}
			return result;
		};

		// Find "Shared" (primary space) - we don't display it, but use it as the root for shared spaces
		const primarySpace = spacesData.find((s) => s.primary);

		// SHARED section: Children of primary space directly (without showing "Shared" itself)
		const sharedTree: SpaceWithDepth[] = [];
		const sharedSpaceIds = new Set<string>();

		if (primarySpace) {
			sharedSpaceIds.add(primarySpace.id);
			// Get direct children of primary space at depth 0
			const directChildren = childrenByParent.get(primarySpace.id) || [];
			for (let i = 0; i < directChildren.length; i++) {
				const child = directChildren[i];
				if (!child) continue;
				const hasChildren = spacesWithChildrenSet.has(child.id);
				const isCollapsed = collapsedSpaces.has(child.id);
				const isLastChild = i === directChildren.length - 1;
				sharedTree.push({ ...child, depth: 0, hasChildren, isLastChild });
				sharedSpaceIds.add(child.id);
				// Get grandchildren at depth 1, etc.
				const descendants = buildTree(child.id, 1, isCollapsed);
				for (const desc of descendants) {
					sharedTree.push(desc);
					sharedSpaceIds.add(desc.id);
				}
			}
		}

		// PRIVATE section: top-level spaces not under Shared (and their children)
		const privateTree: SpaceWithDepth[] = [];
		const topLevelPrivate = spacesData.filter(
			(s) => !s.primary && !s.parentSpaceId && !sharedSpaceIds.has(s.id),
		);

		for (let i = 0; i < topLevelPrivate.length; i++) {
			const space = topLevelPrivate[i];
			if (!space) continue;
			const hasChildren = spacesWithChildrenSet.has(space.id);
			const isCollapsed = collapsedSpaces.has(space.id);
			const isLastChild = i === topLevelPrivate.length - 1;
			privateTree.push({ ...space, depth: 0, hasChildren, isLastChild });
			privateTree.push(...buildTree(space.id, 1, isCollapsed));
		}

		return {
			sharedSpaces: showAllSpaces ? sharedTree : sharedTree.slice(0, 5),
			privateSpaces: privateTree,
			hasMoreShared: sharedTree.length > 5,
			hiddenSharedCount: Math.max(0, sharedTree.length - 5),
			hasMorePrivate: privateTree.length > 3,
			hiddenPrivateCount: Math.max(0, privateTree.length - 3),
			spacesWithChildren: spacesWithChildrenSet,
		};
	}, [spacesData, showAllSpaces, collapsedSpaces]);

	const handleDragOver = (e: React.DragEvent, spaceId: string) => {
		e.preventDefault();
		setActiveDropTarget(spaceId);
	};

	const handleDragLeave = () => {
		setActiveDropTarget(null);
	};

	const handleDrop = async (
		e: React.DragEvent,
		spaceId: Space.SpaceIdOrOrganisationId,
	) => {
		e.preventDefault();
		setActiveDropTarget(null);

		try {
			const capData = e.dataTransfer.getData("application/cap");
			if (!capData) return;

			const cap = JSON.parse(capData);

			// Call the share action with just this space ID
			const result = await shareCap({
				capId: cap.id,
				spaceIds: [spaceId],
			});

			if (result.success) {
				const space = spacesData.find((s) => s.id === spaceId);
				toast.success(`Shared "${cap.name}" to ${space?.name || "folder"}`);
				router.refresh();
			} else {
				toast.error(result.error || "Failed to share cap");
			}
		} catch (error) {
			console.error("Error sharing cap:", error);
			toast.error("Failed to share cap");
		}
	};

	const activeSpaceParams = (spaceId: Space.SpaceIdOrOrganisationId) =>
		params.spaceId === spaceId;

	return (
		<div className="flex flex-col mt-4">
			<div
				className={clsx(
					"flex items-center mb-3",
					sidebarCollapsed ? "justify-center" : "justify-between",
				)}
			>
				<h2
					className={clsx(
						"text-sm font-medium truncate text-gray-12",
						sidebarCollapsed ? "hidden" : "flex",
					)}
				>
					Folders
				</h2>
				<Tooltip position="right" content="Create folder">
					<Button
						className={clsx(
							"p-0 min-w-[unset] hover:bg-gray-3",
							sidebarCollapsed ? "size-8" : "size-7",
						)}
						variant="white"
						onClick={() => {
							setShowSpaceDialog(true);
						}}
					>
						<FontAwesomeIcon
							className={clsx(
								"text-gray-12",
								sidebarCollapsed ? "size-4" : "size-3",
							)}
							icon={faPlus}
						/>
					</Button>
				</Tooltip>
			</div>

			<Tooltip
				content="Browse folders"
				disable={sidebarCollapsed === false}
				position="right"
			>
				<Link
					passHref
					onClick={() => toggleMobileNav?.()}
					prefetch={true}
					onMouseEnter={() => layersIconRef.current?.startAnimation()}
					onMouseLeave={() => layersIconRef.current?.stopAnimation()}
					href="/dashboard/spaces/browse"
					className={clsx(
						"relative border border-transparent transition z-3",
						sidebarCollapsed
							? "flex justify-center px-0 mb-2 items-center w-full size-10"
							: "py-2 w-full px-3 mb-2",
						pathname.includes("/dashboard/spaces/browse")
							? "bg-gray-3 pointer-events-none"
							: "hover:bg-gray-2",
						"flex items-center justify-start rounded-xl outline-none tracking-tight overflow-hidden",
					)}
				>
					<LayersIcon
						ref={layersIconRef}
						className={clsx(sidebarCollapsed ? "text-gray-12" : "text-gray-10")}
						size={sidebarCollapsed ? 18 : 14}
					/>
					<p
						className={clsx(
							"text-sm text-gray-12 truncate",
							sidebarCollapsed ? "hidden" : "ml-2.5",
						)}
					>
						Browse folders
					</p>
				</Link>
			</Tooltip>

			{/* SHARED SPACES SECTION */}
			{sharedSpaces.length > 0 && (
				<>
					{!sidebarCollapsed && (
						<div className="flex items-center mb-2">
							<span className="text-xs font-medium uppercase tracking-wider text-gray-9">
								Shared
							</span>
						</div>
					)}
					<div className="overflow-hidden">
						<div
							className={clsx(
								"transition-all duration-300",
								showAllSpaces && !sidebarCollapsed
									? "max-h-[calc(100vh-450px)] overflow-y-auto"
									: "max-h-max overflow-hidden",
							)}
							style={{
								scrollbarWidth: "none",
								msOverflowStyle: "none",
								WebkitOverflowScrolling: "touch",
							}}
						>
							{sharedSpaces.map((space) => (
								<SpaceItem
									key={space.id}
									space={space}
									depth={space.depth}
									hasChildren={space.hasChildren}
									isLastChild={space.isLastChild}
									isCollapsed={collapsedSpaces.has(space.id)}
									onToggleCollapse={() => toggleSpaceCollapse(space.id)}
									isOwner={space.createdById === user?.id}
									isShared={true}
									sidebarCollapsed={sidebarCollapsed}
									activeSpaceParams={activeSpaceParams}
									activeDropTarget={activeDropTarget}
									handleDragOver={handleDragOver}
									handleDragLeave={handleDragLeave}
									handleDrop={handleDrop}
									handleDeleteSpace={handleDeleteSpace}
								/>
							))}
						</div>
					</div>
				</>
			)}

			<SpaceToggleControl
				showAllSpaces={showAllSpaces}
				hasMoreSpaces={hasMoreShared}
				sidebarCollapsed={sidebarCollapsed}
				hiddenSpacesCount={hiddenSharedCount}
				setShowAllSpaces={setShowAllSpaces}
			/>

			{/* PRIVATE SPACES SECTION */}
			{privateSpaces.length > 0 && !sidebarCollapsed && (
				<>
					<div className="flex items-center mt-4 mb-2">
						<span className="text-xs font-medium uppercase tracking-wider text-gray-9">
							Private
						</span>
					</div>
					<div className="overflow-hidden">
						{privateSpaces.map((space) => (
							<SpaceItem
								key={space.id}
								space={space}
								depth={space.depth}
								hasChildren={space.hasChildren}
								isLastChild={space.isLastChild}
								isCollapsed={collapsedSpaces.has(space.id)}
								onToggleCollapse={() => toggleSpaceCollapse(space.id)}
								isOwner={space.createdById === user?.id}
								isShared={false}
								sidebarCollapsed={sidebarCollapsed}
								activeSpaceParams={activeSpaceParams}
								activeDropTarget={activeDropTarget}
								handleDragOver={handleDragOver}
								handleDragLeave={handleDragLeave}
								handleDrop={handleDrop}
								handleDeleteSpace={handleDeleteSpace}
							/>
						))}
					</div>
				</>
			)}

			<ConfirmationDialog
				open={confirmOpen}
				icon={<FontAwesomeIcon icon={faLayerGroup} />}
				title="Delete folder"
				description={
					pendingDeleteSpace
						? `Are you sure you want to delete the folder "${pendingDeleteSpace.name}"? This action cannot be undone.`
						: ""
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
			<SpaceDialog
				open={showSpaceDialog}
				onClose={() => setShowSpaceDialog(false)}
				onSpaceUpdated={() => {
					router.refresh();
					setShowSpaceDialog(false);
				}}
			/>
		</div>
	);
};

// Depth indicator shapes: ○ (level 1), △ (level 2), □ (level 3+)
const DepthIndicator = ({ depth }: { depth: number }) => {
	if (depth === 0) return null;

	const shapes = ["○", "△", "□"];
	const shape = shapes[Math.min(depth - 1, shapes.length - 1)];

	// Base indent of 24px (to match parent's chevron/spacer) + 12px per additional depth level
	const indent = 24 + (depth - 1) * 12;

	return (
		<span
			className="text-[10px] text-gray-8 mr-1.5 flex-shrink-0 w-3 text-center"
			style={{ marginLeft: `${indent}px` }}
		>
			{shape}
		</span>
	);
};

// SpaceItem component for rendering individual spaces with depth-based indentation
const SpaceItem = ({
	space,
	depth,
	hasChildren,
	isCollapsed,
	onToggleCollapse,
	isOwner,
	isShared,
	sidebarCollapsed,
	activeSpaceParams,
	activeDropTarget,
	handleDragOver,
	handleDragLeave,
	handleDrop,
	handleDeleteSpace,
}: {
	space: Spaces;
	depth: number;
	hasChildren: boolean;
	isLastChild: boolean;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	isOwner: boolean;
	isShared: boolean;
	sidebarCollapsed: boolean;
	activeSpaceParams: (spaceId: Space.SpaceIdOrOrganisationId) => boolean;
	activeDropTarget: string | null;
	handleDragOver: (e: React.DragEvent, spaceId: string) => void;
	handleDragLeave: () => void;
	handleDrop: (
		e: React.DragEvent,
		spaceId: Space.SpaceIdOrOrganisationId,
	) => void;
	handleDeleteSpace: (e: React.MouseEvent, space: Spaces) => void;
}) => {
	return (
		<Tooltip position="right" disable={!sidebarCollapsed} content={space.name}>
			<div
				className={clsx(
					"relative transition-colors border border-transparent overflow-visible duration-150 rounded-xl mb-1 flex items-stretch",
					activeSpaceParams(space.id)
						? "hover:bg-gray-3 cursor-default"
						: "cursor-pointer",
				)}
				onDragOver={(e) => handleDragOver(e, space.id)}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, space.id)}
			>
				{/* Main content wrapper */}
				<div className="flex-1 relative">
					{activeSpaceParams(space.id) && (
						<motion.div
							layoutId="navlinks"
							className={clsx(
								"absolute rounded-xl bg-gray-3",
								sidebarCollapsed ? "inset-0 right-0 left-0 mx-auto" : "inset-0",
							)}
							style={{ willChange: "transform" }}
							transition={{
								layout: {
									type: "tween",
									duration: 0.1,
								},
							}}
						/>
					)}
					<AnimatePresence>
						{activeDropTarget === space.id && (
							<motion.div
								className="absolute inset-0 z-10 rounded-xl border transition-all duration-200 pointer-events-none border-blue-10 bg-gray-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
						)}
					</AnimatePresence>
					<div
						className={clsx(
							"flex relative z-10 items-center px-2 py-1.5 truncate rounded-xl transition-colors group",
							sidebarCollapsed ? "justify-center" : "",
							activeSpaceParams(space.id)
								? "hover:bg-gray-3"
								: "hover:bg-gray-2",
							space.primary ? "h-10" : "h-fit",
						)}
					>
						{/* Collapse/Expand chevron for spaces with children */}
						{!sidebarCollapsed && hasChildren && (
							<div
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onToggleCollapse();
								}}
								className="flex justify-center items-center mr-1 rounded hover:bg-gray-4 size-5 flex-shrink-0 cursor-pointer"
							>
								{isCollapsed ? (
									<ChevronRight size={14} className="text-gray-10" />
								) : (
									<ChevronDown size={14} className="text-gray-10" />
								)}
							</div>
						)}
						{/* Spacer for alignment when no children at depth 0 */}
						{!sidebarCollapsed && !hasChildren && depth === 0 && (
							<div className="w-6 flex-shrink-0" />
						)}
						{/* Depth indicator shape for child items */}
						{!sidebarCollapsed && depth > 0 && !hasChildren && (
							<DepthIndicator depth={depth} />
						)}
						{/* Indentation for items with children at depth > 0 */}
						{!sidebarCollapsed && depth > 0 && hasChildren && (
							<span
								className="flex-shrink-0"
								style={{ marginLeft: `${24 + (depth - 1) * 12}px` }}
							/>
						)}
						<Link
							href={`/dashboard/spaces/${space.id}`}
							className="flex items-center flex-1 min-w-0"
						>
							{/* Only show avatar when sidebar is collapsed */}
							{sidebarCollapsed && (
								<SignedImageUrl
									image={space.iconUrl}
									name={space.name}
									letterClass="text-sm"
									className="relative flex-shrink-0 size-6"
								/>
							)}
							{!sidebarCollapsed && (
								<span className="text-sm truncate transition-colors text-gray-11 group-hover:text-gray-12">
									{space.name}
								</span>
							)}
						</Link>
						{!sidebarCollapsed && (
							<>
								{/* Hide delete button for Shared spaces and primary entry */}
								{!space.primary && isOwner && !isShared && (
									<div
										onClick={(e) => handleDeleteSpace(e, space)}
										className={
											"flex justify-center items-center ml-auto rounded-full opacity-0 transition-all group size-6 group-hover:opacity-100 hover:bg-gray-4"
										}
										aria-label={`Delete ${space.name} folder`}
									>
										<FontAwesomeIcon
											icon={faXmark}
											className="size-3.5 text-gray-12"
										/>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</Tooltip>
	);
};

const SpaceToggleControl = ({
	showAllSpaces,
	hasMoreSpaces,
	sidebarCollapsed,
	hiddenSpacesCount,
	setShowAllSpaces,
}: {
	showAllSpaces: boolean;
	hasMoreSpaces: boolean;
	sidebarCollapsed: boolean;
	hiddenSpacesCount: number;
	setShowAllSpaces: (show: boolean) => void;
}) => {
	if (sidebarCollapsed) return null;
	if (!showAllSpaces && hasMoreSpaces) {
		return (
			<div
				onClick={() => setShowAllSpaces(true)}
				className="flex justify-between items-center p-2 w-full truncate rounded-xl transition-colors cursor-pointer text-gray-10 hover:text-gray-12 hover:bg-gray-3"
			>
				<span className="text-sm text-gray-10">+ {hiddenSpacesCount} more</span>
				<ChevronDown size={16} className="ml-2" />
			</div>
		);
	}
	if (showAllSpaces) {
		return (
			<div
				onClick={() => setShowAllSpaces(false)}
				className="flex justify-between items-center p-2 w-full truncate rounded-xl transition-colors cursor-pointer text-gray-10 hover:text-gray-12 hover:bg-gray-3"
			>
				<span className="text-sm text-gray-10">Show less</span>
				<ChevronUp size={16} className="ml-2" />
			</div>
		);
	}
	return null;
};

export default SpacesList;
