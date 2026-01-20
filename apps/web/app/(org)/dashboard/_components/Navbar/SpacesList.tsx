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
import { ChevronDown, ChevronUp } from "lucide-react";
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
	const router = useRouter();
	const params = useParams();
	const pathname = usePathname();
	const layersIconRef = useRef<LayersIconHandle>(null);

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

	if (!spacesData) return null;

	// Build hierarchical structure with multi-level support and PUBLIC/PRIVATE sections
	type SpaceWithDepth = Spaces & { depth: number };

	const { publicSpaces, privateSpaces, hasMorePublic, hiddenPublicCount, hasMorePrivate, hiddenPrivateCount } = useMemo(() => {
		// Build children map for quick lookup
		const childrenByParent = new Map<string, Spaces[]>();
		for (const space of spacesData) {
			if (space.parentSpaceId) {
				const children = childrenByParent.get(space.parentSpaceId) || [];
				children.push(space);
				childrenByParent.set(space.parentSpaceId, children);
			}
		}

		// Recursively build tree with depth
		const buildTree = (parentId: string, depth: number): SpaceWithDepth[] => {
			const children = childrenByParent.get(parentId) || [];
			const result: SpaceWithDepth[] = [];
			for (const child of children) {
				result.push({ ...child, depth });
				result.push(...buildTree(child.id, depth + 1));
			}
			return result;
		};

		// Find "All Wallester" (primary space)
		const primarySpace = spacesData.find(s => s.primary);

		// PUBLIC section: All Wallester + all children
		const publicTree: SpaceWithDepth[] = [];
		const publicSpaceIds = new Set<string>();

		if (primarySpace) {
			publicTree.push({ ...primarySpace, depth: 0 });
			publicSpaceIds.add(primarySpace.id);
			const children = buildTree(primarySpace.id, 1);
			for (const child of children) {
				publicTree.push(child);
				publicSpaceIds.add(child.id);
			}
		}

		// PRIVATE section: top-level spaces not under All Wallester (and their children)
		const privateTree: SpaceWithDepth[] = [];
		const topLevelPrivate = spacesData.filter(s =>
			!s.primary && !s.parentSpaceId && !publicSpaceIds.has(s.id)
		);

		for (const space of topLevelPrivate) {
			privateTree.push({ ...space, depth: 0 });
			privateTree.push(...buildTree(space.id, 1));
		}

		return {
			publicSpaces: showAllSpaces ? publicTree : publicTree.slice(0, 5),
			privateSpaces: privateTree,
			hasMorePublic: publicTree.length > 5,
			hiddenPublicCount: Math.max(0, publicTree.length - 5),
			hasMorePrivate: privateTree.length > 3,
			hiddenPrivateCount: Math.max(0, privateTree.length - 3),
		};
	}, [spacesData, showAllSpaces]);

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
				toast.success(`Shared "${cap.name}" to ${space?.name || "space"}`);
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
					Spaces
				</h2>
				<Tooltip position="right" content="Create space">
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
				content="Browse spaces"
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
						Browse spaces
					</p>
				</Link>
			</Tooltip>

			{/* PUBLIC SPACES SECTION */}
			{publicSpaces.length > 0 && (
				<>
					{!sidebarCollapsed && (
						<div className="flex items-center mb-2">
							<span className="text-xs font-medium uppercase tracking-wider text-gray-9">
								Public
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
							{publicSpaces.map((space) => (
							<SpaceItem
								key={space.id}
								space={space}
								depth={space.depth}
								isOwner={space.createdById === user?.id}
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
				hasMoreSpaces={hasMorePublic}
				sidebarCollapsed={sidebarCollapsed}
				hiddenSpacesCount={hiddenPublicCount}
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
								isOwner={space.createdById === user?.id}
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
				title="Delete space"
				description={
					pendingDeleteSpace
						? `Are you sure you want to delete the space "${pendingDeleteSpace.name}"? This action cannot be undone.`
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

// SpaceItem component for rendering individual spaces with depth-based indentation
const SpaceItem = ({
	space,
	depth,
	isOwner,
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
	isOwner: boolean;
	sidebarCollapsed: boolean;
	activeSpaceParams: (spaceId: Space.SpaceIdOrOrganisationId) => boolean;
	activeDropTarget: string | null;
	handleDragOver: (e: React.DragEvent, spaceId: string) => void;
	handleDragLeave: () => void;
	handleDrop: (e: React.DragEvent, spaceId: Space.SpaceIdOrOrganisationId) => void;
	handleDeleteSpace: (e: React.MouseEvent, space: Spaces) => void;
}) => {
	// Calculate indentation: 16px (ml-4) per depth level
	const indentStyle = !sidebarCollapsed && depth > 0
		? { marginLeft: `${depth * 16}px` }
		: undefined;

	return (
		<Tooltip
			position="right"
			disable={!sidebarCollapsed}
			content={space.name}
		>
			<div
				className={clsx(
					"relative transition-colors border border-transparent overflow-visible duration-150 rounded-xl mb-1.5",
					activeSpaceParams(space.id)
						? "hover:bg-gray-3 cursor-default"
						: "cursor-pointer",
				)}
				style={indentStyle}
				onDragOver={(e) => handleDragOver(e, space.id)}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, space.id)}
			>
				{activeSpaceParams(space.id) && (
					<motion.div
						layoutId="navlinks"
						className={clsx(
							"absolute rounded-xl bg-gray-3",
							sidebarCollapsed
								? "inset-0 right-0 left-0 mx-auto"
								: "inset-0",
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
				<Link
					href={`/dashboard/spaces/${space.id}`}
					className={clsx(
						"flex relative z-10 items-center px-2 py-2 truncate rounded-xl transition-colors group",
						sidebarCollapsed ? "justify-center" : "",
						activeSpaceParams(space.id)
							? "hover:bg-gray-3"
							: "hover:bg-gray-2",
						space.primary ? "h-10" : "h-fit",
					)}
				>
					<SignedImageUrl
						image={space.iconUrl}
						name={space.name}
						letterClass={clsx(
							sidebarCollapsed ? "text-sm" : "text-[11px]",
						)}
						className={clsx(
							"relative flex-shrink-0",
							sidebarCollapsed ? "size-6" : "size-5",
						)}
					/>
					{!sidebarCollapsed && (
						<>
							<span className="ml-2.5 text-sm truncate transition-colors text-gray-11 group-hover:text-gray-12">
								{space.name}
							</span>
							{/* Hide delete button for 'All spaces' synthetic entry */}
							{!space.primary && isOwner && (
								<div
									onClick={(e) => handleDeleteSpace(e, space)}
									className={
										"flex justify-center items-center ml-auto rounded-full opacity-0 transition-all group size-6 group-hover:opacity-100 hover:bg-gray-4"
									}
									aria-label={`Delete ${space.name} space`}
								>
									<FontAwesomeIcon
										icon={faXmark}
										className="size-3.5 text-gray-12"
									/>
								</div>
							)}
						</>
					)}
				</Link>
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
