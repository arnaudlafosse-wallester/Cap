"use client";

import type { VideoMetadata } from "@cap/database/types";
import type { Video } from "@cap/web-domain";
import { faBuilding, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CapCard } from "../../../caps/components/CapCard/CapCard";
import { SharingDialog } from "../../../caps/components/SharingDialog";

interface SharedCapCardProps {
	cap: {
		id: Video.VideoId;
		ownerId: string;
		name: string;
		createdAt: Date;
		totalComments: number;
		totalReactions: number;
		ownerName: string | null;
		metadata?: VideoMetadata;
		hasActiveUpload: boolean | undefined;
		public?: boolean;
	};
	analytics: number;
	isLoadingAnalytics: boolean;
	organizationName: string;
	userId?: string;
	hideSharedStatus?: boolean;
	spaceName?: string;
	spaceId?: string;
	organizationId?: string;
	onDragStart?: () => void;
	onDragEnd?: () => void;
}

export const SharedCapCard: React.FC<SharedCapCardProps> = ({
	cap,
	analytics,
	organizationName,
	userId,
	hideSharedStatus,
	isLoadingAnalytics,
	spaceName,
	spaceId,
	organizationId,
	onDragStart,
	onDragEnd,
}) => {
	const router = useRouter();
	const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
	const displayCount =
		analytics === 0
			? Math.max(cap.totalComments, cap.totalReactions)
			: analytics;
	const isOwner = userId === cap.ownerId;

	// Build current sharedSpaces from the space we're viewing
	const currentSharedSpaces = spaceId
		? [
				{
					id: spaceId,
					name: spaceName || "",
					organizationId: organizationId || "",
				},
			]
		: [];

	const handleSharingUpdated = () => {
		router.refresh();
	};

	return (
		<>
			<div onDragStart={onDragStart} onDragEnd={onDragEnd}>
				<CapCard
					hideSharedStatus={hideSharedStatus}
					isLoadingAnalytics={isLoadingAnalytics}
					cap={cap}
					analytics={displayCount}
					userId={userId}
				>
					<div className="mb-2 space-y-1">
						{cap.ownerName && (
							<div className="flex gap-2 items-center">
								<FontAwesomeIcon icon={faUser} className="text-gray-10 size-3" />
								<span className="text-sm text-gray-10">{cap.ownerName}</span>
							</div>
						)}
						{isOwner && (
							<div className="flex gap-2 items-center">
								<FontAwesomeIcon
									icon={faBuilding}
									className="text-gray-10 size-2.5"
								/>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setIsSharingDialogOpen(true);
									}}
									className="text-sm text-gray-10 hover:text-gray-12 transition-colors"
								>
									Shared with{" "}
									<span className="text-sm font-medium text-gray-12 hover:underline">
										{spaceName || organizationName}
									</span>
								</button>
							</div>
						)}
					</div>
				</CapCard>
			</div>
			{isOwner && (
				<SharingDialog
					isOpen={isSharingDialogOpen}
					onClose={() => setIsSharingDialogOpen(false)}
					capId={cap.id}
					capName={cap.name}
					sharedSpaces={currentSharedSpaces}
					onSharingUpdated={handleSharingUpdated}
					isPublic={cap.public ?? false}
				/>
			)}
		</>
	);
};
