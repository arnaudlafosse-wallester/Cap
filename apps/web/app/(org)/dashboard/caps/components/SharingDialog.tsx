import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Switch,
} from "@cap/ui";
import { type ImageUpload, Space, type Video } from "@cap/web-domain";
import { faCopy, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { Globe2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { shareCap } from "@/actions/caps/share";
import { useDashboardContext } from "@/app/(org)/dashboard/Contexts";
import type { Spaces } from "@/app/(org)/dashboard/dashboard-data";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { usePublicEnv } from "@/utils/public-env";

interface SharingDialogProps {
	isOpen: boolean;
	onClose: () => void;
	capId: Video.VideoId;
	capName: string;
	sharedSpaces: {
		id: string;
		name: string;
		iconUrl?: string | null;
		organizationId: string;
	}[];
	onSharingUpdated: (updatedSharedSpaces: string[]) => void;
	isPublic?: boolean;
	spacesData?: Spaces[] | null;
}

export const SharingDialog: React.FC<SharingDialogProps> = ({
	isOpen,
	onClose,
	capId,
	capName,
	sharedSpaces,
	onSharingUpdated,
	isPublic = false,
	spacesData: propSpacesData = null,
}) => {
	const { spacesData: contextSpacesData } = useDashboardContext();
	const spacesData = propSpacesData || contextSpacesData;
	const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
	const [searchTerm, setSearchTerm] = useState("");
	const [initialSelectedSpaces, setInitialSelectedSpaces] = useState<
		Set<string>
	>(new Set());
	const [publicToggle, setPublicToggle] = useState(isPublic);
	const [initialPublicState, setInitialPublicState] = useState(isPublic);
	const tabs = ["Share", "Embed"] as const;
	const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Share");

	const updateSharing = useMutation({
		mutationFn: async ({
			capId,
			spaceIds,
			public: isPublic,
		}: {
			capId: Video.VideoId;
			spaceIds: Space.SpaceIdOrOrganisationId[];
			public: boolean;
		}) => {
			const result = await shareCap({ capId, spaceIds, public: isPublic });

			if (!result.success) {
				throw new Error(result.error || "Failed to update sharing settings");
			}
		},
		onSuccess: () => {
			const newSelectedSpaces = Array.from(selectedSpaces);
			const initialSpaces = Array.from(initialSelectedSpaces);

			const addedSpaceIds = newSelectedSpaces.filter(
				(id) => !initialSpaces.includes(id),
			);
			const removedSpaceIds = initialSpaces.filter(
				(id) => !newSelectedSpaces.includes(id),
			);

			const publicChanged = publicToggle !== initialPublicState;

			const getSpaceName = (id: string) => {
				const space = spacesData?.find((space) => space.id === id);
				return space?.name || `Space ${id}`;
			};

			if (
				publicChanged &&
				addedSpaceIds.length === 0 &&
				removedSpaceIds.length === 0
			) {
				toast.success(
					publicToggle ? "Video is now public" : "Video is now private",
				);
			} else if (
				addedSpaceIds.length === 1 &&
				removedSpaceIds.length === 0 &&
				!publicChanged
			) {
				toast.success(`Shared to ${getSpaceName(addedSpaceIds[0] as string)}`);
			} else if (
				removedSpaceIds.length === 1 &&
				addedSpaceIds.length === 0 &&
				!publicChanged
			) {
				toast.success(
					`Unshared from ${getSpaceName(removedSpaceIds[0] as string)}`,
				);
			} else if (
				addedSpaceIds.length > 0 &&
				removedSpaceIds.length === 0 &&
				!publicChanged
			) {
				toast.success(`Shared to ${addedSpaceIds.length} spaces`);
			} else if (
				removedSpaceIds.length > 0 &&
				addedSpaceIds.length === 0 &&
				!publicChanged
			) {
				toast.success(`Unshared from ${removedSpaceIds.length} spaces`);
			} else if (
				addedSpaceIds.length > 0 ||
				removedSpaceIds.length > 0 ||
				publicChanged
			) {
				toast.success(`Sharing settings updated`);
			} else {
				toast.info("No changes to sharing settings");
			}
			onSharingUpdated(newSelectedSpaces);
			onClose();
		},
		onError: () => {
			toast.error("Failed to update sharing settings");
		},
	});

	useEffect(() => {
		if (isOpen && sharedSpaces) {
			const spaceIds = new Set(sharedSpaces.map((space) => space.id));
			setSelectedSpaces(spaceIds);
			setInitialSelectedSpaces(spaceIds);
			setPublicToggle(isPublic);
			setInitialPublicState(isPublic);
			setSearchTerm("");
			setActiveTab(tabs[0]);
		}
	}, [isOpen, sharedSpaces, isPublic, tabs[0]]);

	const handleToggleSpace = (spaceId: string) => {
		setSelectedSpaces((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(spaceId)) {
				newSet.delete(spaceId);
			} else {
				newSet.add(spaceId);
			}
			return newSet;
		});
	};

	const embedCode = useEmbedCode(capId);

	const handleCopyEmbedCode = async () => {
		try {
			await navigator.clipboard.writeText(embedCode);
			toast.success("Embed code copied to clipboard");
		} catch (_error) {
			toast.error("Failed to copy embed code");
		}
	};

	// Build hierarchical structure for SHARED and PRIVATE sections
	type SpaceWithDepth = Spaces & { depth: number };

	const { sharedHierarchy, privateHierarchy } = useMemo(() => {
		if (!spacesData) return { sharedHierarchy: [], privateHierarchy: [] };

		// Find primary space (root of SHARED)
		const primarySpace = spacesData.find((s) => s.primary);
		const sharedSpaceIds = new Set<string>();
		if (primarySpace) {
			sharedSpaceIds.add(primarySpace.id);
		}

		// Build children map
		const childrenByParent = new Map<string, Spaces[]>();
		for (const space of spacesData) {
			if (space.parentSpaceId) {
				const children = childrenByParent.get(space.parentSpaceId) || [];
				children.push(space);
				childrenByParent.set(space.parentSpaceId, children);
			}
		}

		// Build tree recursively
		const buildTree = (
			parentId: string,
			depth: number,
			isShared: boolean,
		): SpaceWithDepth[] => {
			const children = childrenByParent.get(parentId) || [];
			const result: SpaceWithDepth[] = [];
			for (const child of children.sort((a, b) =>
				a.name.localeCompare(b.name),
			)) {
				result.push({ ...child, depth });
				if (isShared) sharedSpaceIds.add(child.id);
				result.push(...buildTree(child.id, depth + 1, isShared));
			}
			return result;
		};

		// SHARED: children of primary space
		const sharedHierarchy: SpaceWithDepth[] = [];
		if (primarySpace) {
			const directChildren = childrenByParent.get(primarySpace.id) || [];
			for (const child of directChildren.sort((a, b) =>
				a.name.localeCompare(b.name),
			)) {
				sharedHierarchy.push({ ...child, depth: 0 });
				sharedSpaceIds.add(child.id);
				sharedHierarchy.push(...buildTree(child.id, 1, true));
			}
		}

		// PRIVATE: top-level spaces not under SHARED
		const privateHierarchy: SpaceWithDepth[] = [];
		const topLevelPrivate = spacesData
			.filter(
				(s) => !s.primary && !s.parentSpaceId && !sharedSpaceIds.has(s.id),
			)
			.sort((a, b) => a.name.localeCompare(b.name));

		for (const space of topLevelPrivate) {
			privateHierarchy.push({ ...space, depth: 0 });
			privateHierarchy.push(...buildTree(space.id, 1, false));
		}

		return { sharedHierarchy, privateHierarchy };
	}, [spacesData]);

	// Filter by search term
	const filteredShared = searchTerm
		? sharedHierarchy.filter((space) =>
				space.name.toLowerCase().includes(searchTerm.toLowerCase()),
			)
		: sharedHierarchy;

	const filteredPrivate = searchTerm
		? privateHierarchy.filter((space) =>
				space.name.toLowerCase().includes(searchTerm.toLowerCase()),
			)
		: privateHierarchy;

	const hasResults = filteredShared.length > 0 || filteredPrivate.length > 0;
	const hasSpaces = sharedHierarchy.length > 0 || privateHierarchy.length > 0;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="p-0 w-full max-w-md rounded-xl border bg-gray-2 border-gray-4">
				<DialogHeader
					icon={<FontAwesomeIcon icon={faShareNodes} className="size-3.5" />}
					description={
						activeTab === "Share"
							? "Select how you would like to share the cap"
							: "Copy the embed code to share your cap"
					}
				>
					<DialogTitle className="truncate w-full max-w-[320px]">
						{activeTab === "Share" ? `Share ${capName}` : `Embed ${capName}`}
					</DialogTitle>
				</DialogHeader>

				<div className="flex w-full h-12 border-b bg-gray-1 border-gray-4">
					{tabs.map((tab) => (
						<div
							key={tab}
							className={clsx(
								"flex relative flex-1 justify-center items-center w-full min-w-0 text-sm font-medium transition-colors",
								activeTab === tab
									? "cursor-not-allowed bg-gray-3"
									: "cursor-pointer",
							)}
							onClick={() => setActiveTab(tab)}
						>
							<p
								className={clsx(
									activeTab === tab
										? "text-gray-12 font-medium"
										: "text-gray-10",
									"text-sm",
								)}
							>
								{tab}
							</p>
						</div>
					))}
				</div>

				<div className="p-5">
					{activeTab === "Share" ? (
						<>
							{/* Public sharing toggle */}
							<div className="p-3 mb-4 rounded-lg border bg-gray-1 border-gray-4">
								<div className="flex justify-between items-center">
									<div className="flex gap-3 items-center">
										<div className="flex justify-center items-center w-8 h-8 rounded-full bg-gray-3">
											<Globe2 className="w-4 h-4 text-gray-11" />
										</div>
										<div>
											<p className="text-sm font-medium text-gray-12">
												Public link
											</p>
											<p className="text-xs text-gray-10">
												{publicToggle
													? "Anyone with the link can view (no login required)"
													: "Only space members can view (login required)"}
											</p>
										</div>
									</div>
									<Switch
										checked={publicToggle}
										onCheckedChange={setPublicToggle}
									/>
								</div>
								<PublicLinkSection
									isPublic={publicToggle}
									capId={capId}
								/>
							</div>

							<div className="relative mb-3">
								<Input
									type="text"
									placeholder="Search and add to spaces..."
									value={searchTerm}
									className="pr-8"
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
								<Search
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-10"
									size={20}
								/>
							</div>
							<div className="overflow-y-auto pt-2 max-h-60 space-y-4">
								{hasResults ? (
									<>
										{/* SHARED Section */}
										{filteredShared.length > 0 && (
											<div>
												<p className="mb-2 text-xs font-medium uppercase text-gray-10">
													Shared
												</p>
												<div className="space-y-0.5">
													{filteredShared.map((space) => (
														<SpaceCheckboxItem
															key={space.id}
															space={space}
															depth={space.depth}
															isSelected={selectedSpaces.has(space.id)}
															onToggle={handleToggleSpace}
														/>
													))}
												</div>
											</div>
										)}

										{/* PRIVATE Section */}
										{filteredPrivate.length > 0 && (
											<div>
												<p className="mb-2 text-xs font-medium uppercase text-gray-10">
													Private
												</p>
												<div className="space-y-0.5">
													{filteredPrivate.map((space) => (
														<SpaceCheckboxItem
															key={space.id}
															space={space}
															depth={space.depth}
															isSelected={selectedSpaces.has(space.id)}
															onToggle={handleToggleSpace}
														/>
													))}
												</div>
											</div>
										)}
									</>
								) : (
									<div className="flex justify-center items-center py-4 text-sm">
										<p className="text-gray-10">
											{hasSpaces
												? "No spaces match your search"
												: "No spaces available"}
										</p>
									</div>
								)}
							</div>
						</>
					) : (
						<div className="space-y-4">
							<div className="p-3 rounded-lg border bg-gray-3 border-gray-4">
								<code className="font-mono text-xs break-all text-gray-11">
									{embedCode}
								</code>
							</div>
							<Button
								className="w-full font-medium"
								variant="dark"
								onClick={handleCopyEmbedCode}
							>
								<FontAwesomeIcon icon={faCopy} className="size-3.5 mr-1" />
								Copy embed code
							</Button>
						</div>
					)}
				</div>

				<DialogFooter className="p-5 border-t border-gray-4">
					{activeTab === "Share" ? (
						<>
							<Button size="sm" variant="gray" onClick={onClose}>
								Cancel
							</Button>
							<Button
								spinner={updateSharing.isPending}
								disabled={updateSharing.isPending}
								size="sm"
								variant="dark"
								onClick={() =>
									updateSharing.mutate({
										capId,
										spaceIds: Array.from(selectedSpaces).map((v) =>
											Space.SpaceId.make(v),
										),
										public: publicToggle,
									})
								}
							>
								{updateSharing.isPending ? "Saving..." : "Save"}
							</Button>
						</>
					) : (
						<Button size="sm" variant="gray" onClick={onClose}>
							Close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const SpaceCheckboxItem = ({
	space,
	depth,
	isSelected,
	onToggle,
}: {
	space: {
		id: string;
		name: string;
		iconUrl?: ImageUpload.ImageUrl | null;
	};
	depth: number;
	isSelected: boolean;
	onToggle: (spaceId: string) => void;
}) => {
	return (
		<div
			className={clsx(
				"flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors",
				isSelected ? "bg-gray-3" : "hover:bg-gray-3",
			)}
			style={{ paddingLeft: `${8 + depth * 16}px` }}
			onClick={() => onToggle(space.id)}
		>
			<Checkbox
				checked={isSelected}
				className="flex-shrink-0 pointer-events-none"
			/>
			<SignedImageUrl
				image={space.iconUrl}
				name={space.name}
				letterClass="text-[10px]"
				className="relative flex-shrink-0 size-5"
			/>
			<span className="text-sm truncate text-gray-12">{space.name}</span>
		</div>
	);
};

const PublicLinkSection = ({
	isPublic,
	capId,
}: {
	isPublic: boolean;
	capId: Video.VideoId;
}) => {
	const publicEnv = usePublicEnv();
	const videoUrl = `${publicEnv.webUrl}/s/${capId}`;

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(videoUrl);
			toast.success("Link copied to clipboard");
		} catch (_error) {
			toast.error("Failed to copy link");
		}
	};

	if (!isPublic) return null;

	return (
		<div className="mt-3 pt-3 border-t border-gray-4">
			<div className="flex gap-2 items-center">
				<input
					type="text"
					readOnly
					value={videoUrl}
					className="flex-1 px-2 py-1.5 text-xs rounded border bg-gray-2 border-gray-4 text-gray-11 truncate"
				/>
				<Button
					size="sm"
					variant="dark"
					onClick={handleCopyLink}
					className="flex-shrink-0"
				>
					<FontAwesomeIcon icon={faCopy} className="size-3 mr-1" />
					Copy
				</Button>
			</div>
			<p className="mt-2 text-xs text-gray-9">
				Share this link with anyone - they can view without logging in.
			</p>
		</div>
	);
};

function useEmbedCode(capId: Video.VideoId) {
	const publicEnv = usePublicEnv();

	return useMemo(
		() =>
			`
	<div style="position: relative; padding-bottom: 56.25%; height: 0;">
			<iframe
			src="${publicEnv.webUrl}/embed/${capId}"
			frameborder="0"
			webkitallowfullscreen
			mozallowfullscreen
			allowfullscreen
			style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
		></iframe>
	</div>
`
				.trim()
				.replace(/[\n\t]+/g, " ")
				.replace(/>\s+</g, "><")
				.replace(/"\s+>/g, '">'),
		[publicEnv.webUrl, capId],
	);
}
