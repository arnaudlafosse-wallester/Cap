"use client";

import { useState } from "react";
import { LabelSelectorDialog } from "./LabelSelectorDialog";
import { RetentionBadge } from "./RetentionBadge";
import { VideoLabelBadge } from "./VideoLabelBadge";

export interface VideoLabel {
	id: string;
	name: string;
	displayName: string;
	color: string;
	category: "content_type" | "department";
	retentionDays: number | null;
	isAiSuggested?: boolean;
	aiConfidence?: number;
}

interface VideoLabelsDisplayProps {
	videoId: string;
	labels: VideoLabel[];
	expiresAt: Date | null;
	keepPermanently?: boolean;
	ragStatus?: "eligible" | "excluded" | "pending";
	isOwner: boolean;
	maxDisplay?: number;
	onLabelsChange?: () => void;
}

export function VideoLabelsDisplay({
	videoId,
	labels,
	expiresAt,
	keepPermanently = false,
	ragStatus,
	isOwner,
	maxDisplay = 3,
	onLabelsChange,
}: VideoLabelsDisplayProps) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	// Separate content type and department labels
	const contentTypeLabels = labels.filter((l) => l.category === "content_type");
	const departmentLabels = labels.filter((l) => l.category === "department");

	// Prioritize showing content type labels, then department
	const displayLabels = [...contentTypeLabels, ...departmentLabels].slice(
		0,
		maxDisplay,
	);
	const hiddenCount = labels.length - displayLabels.length;

	if (labels.length === 0 && !expiresAt) {
		// Show placeholder for owners to add labels
		if (isOwner) {
			return (
				<button
					type="button"
					onClick={() => setIsDialogOpen(true)}
					className="text-xs text-gray-9 hover:text-gray-11 transition-colors flex items-center gap-1"
				>
					<span className="text-lg leading-none">+</span>
					<span>Add labels</span>
				</button>
			);
		}
		return null;
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-1.5">
				{/* Retention badge first if present */}
				<RetentionBadge
					expiresAt={expiresAt}
					keepPermanently={keepPermanently}
					size="sm"
				/>

				{/* RAG status indicator */}
				{ragStatus && ragStatus !== "pending" && (
					<span
						className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
							ragStatus === "eligible"
								? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
								: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
						}`}
						title={
							ragStatus === "eligible"
								? "This video is indexed in the knowledge base"
								: "This video is excluded from the knowledge base"
						}
					>
						{ragStatus === "eligible" ? "📚 KB" : "—"}
					</span>
				)}

				{/* Label badges */}
				{displayLabels.map((label) => (
					<VideoLabelBadge
						key={label.id}
						name={label.name}
						displayName={label.displayName}
						color={label.color}
						size="sm"
						isAiSuggested={label.isAiSuggested}
						confidence={label.aiConfidence}
						onClick={isOwner ? () => setIsDialogOpen(true) : undefined}
					/>
				))}

				{/* Hidden count */}
				{hiddenCount > 0 && (
					<span
						className="text-xs text-gray-9 cursor-pointer hover:text-gray-11"
						onClick={() => setIsDialogOpen(true)}
					>
						+{hiddenCount}
					</span>
				)}

				{/* Add button for owners */}
				{isOwner && labels.length > 0 && labels.length < 5 && (
					<button
						type="button"
						onClick={() => setIsDialogOpen(true)}
						className="text-xs text-gray-9 hover:text-gray-11 transition-colors px-1"
					>
						+
					</button>
				)}
			</div>

			{/* Label selector dialog */}
			{isOwner && (
				<LabelSelectorDialog
					open={isDialogOpen}
					onClose={() => setIsDialogOpen(false)}
					videoId={videoId}
					currentLabels={labels}
					expiresAt={expiresAt}
					keepPermanently={keepPermanently}
					ragStatus={ragStatus}
					onLabelsChange={onLabelsChange}
				/>
			)}
		</>
	);
}
