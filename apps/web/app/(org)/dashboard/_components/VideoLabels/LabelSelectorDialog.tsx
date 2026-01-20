"use client";

import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Switch,
} from "@cap/ui";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardContext } from "../../Contexts";
import type { VideoLabel } from "./VideoLabelsDisplay";
import { VideoLabelBadge } from "./VideoLabelBadge";

interface LabelSelectorDialogProps {
	open: boolean;
	onClose: () => void;
	videoId: string;
	currentLabels: VideoLabel[];
	expiresAt: Date | null;
	keepPermanently?: boolean;
	ragStatus?: "eligible" | "excluded" | "pending";
	onLabelsChange?: () => void;
}

interface AvailableLabel {
	id: string;
	name: string;
	displayName: string;
	description: string | null;
	color: string;
	category: "content_type" | "department";
	retentionDays: number | null;
	ragDefault: "eligible" | "excluded" | "pending";
}

export function LabelSelectorDialog({
	open,
	onClose,
	videoId,
	currentLabels,
	expiresAt,
	keepPermanently = false,
	ragStatus,
	onLabelsChange,
}: LabelSelectorDialogProps) {
	const router = useRouter();
	const { activeOrganization } = useDashboardContext();

	const [availableLabels, setAvailableLabels] = useState<AvailableLabel[]>([]);
	const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
		new Set(currentLabels.map((l) => l.id)),
	);
	const [isKeepPermanently, setIsKeepPermanently] = useState(keepPermanently);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isClassifying, setIsClassifying] = useState(false);

	// Fetch available labels on mount
	useEffect(() => {
		if (open && activeOrganization?.organization.id) {
			fetchLabels();
		}
	}, [open, activeOrganization?.organization.id]);

	// Reset selected labels when dialog opens
	useEffect(() => {
		if (open) {
			setSelectedLabelIds(new Set(currentLabels.map((l) => l.id)));
			setIsKeepPermanently(keepPermanently);
		}
	}, [open, currentLabels, keepPermanently]);

	const fetchLabels = async () => {
		setIsLoading(true);
		try {
			const response = await fetch(`/api/labels`);
			if (response.ok) {
				const data = await response.json();
				setAvailableLabels(data.labels || []);
			}
		} catch (error) {
			console.error("Failed to fetch labels:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const toggleLabel = (labelId: string) => {
		setSelectedLabelIds((prev) => {
			const next = new Set(prev);
			if (next.has(labelId)) {
				next.delete(labelId);
			} else {
				next.add(labelId);
			}
			return next;
		});
	};

	// Calculate minimum retention from selected labels
	const selectedLabels = availableLabels.filter((l) =>
		selectedLabelIds.has(l.id),
	);
	const retentionDays = selectedLabels
		.map((l) => l.retentionDays)
		.filter((d): d is number => d !== null);
	const minRetention =
		retentionDays.length > 0 ? Math.min(...retentionDays) : null;

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/videos/${videoId}/labels`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					labelIds: Array.from(selectedLabelIds),
					keepPermanently: isKeepPermanently,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to save labels");
			}

			toast.success("Labels saved successfully");
			router.refresh();
			onLabelsChange?.();
			onClose();
		} catch (error) {
			console.error("Failed to save labels:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to save labels",
			);
		} finally {
			setIsSaving(false);
		}
	};

	const handleClassify = async () => {
		setIsClassifying(true);
		try {
			const response = await fetch(`/api/videos/${videoId}/classify`, {
				method: "POST",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Classification failed");
			}

			const data = await response.json();
			toast.success(
				`AI suggested ${data.classification?.labels?.length || 0} labels`,
			);

			// Refresh labels
			await fetchLabels();
			router.refresh();

			// Auto-select suggested labels with high confidence
			if (data.classification?.labels) {
				const suggestedNames = data.classification.labels
					.filter((l: { confidence: number }) => l.confidence >= 0.75)
					.map((l: { labelName: string }) => l.labelName);

				const labelsToAdd = availableLabels.filter((l) =>
					suggestedNames.includes(l.name),
				);
				setSelectedLabelIds((prev) => {
					const next = new Set(prev);
					labelsToAdd.forEach((l) => next.add(l.id));
					return next;
				});
			}
		} catch (error) {
			console.error("Classification failed:", error);
			toast.error(
				error instanceof Error ? error.message : "Classification failed",
			);
		} finally {
			setIsClassifying(false);
		}
	};

	// Group labels by category
	const contentTypeLabels = availableLabels.filter(
		(l) => l.category === "content_type",
	);
	const departmentLabels = availableLabels.filter(
		(l) => l.category === "department",
	);

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="p-0 w-[calc(100%-20px)] max-w-lg rounded-xl border bg-gray-2 border-gray-4">
				<DialogHeader
					icon={<FontAwesomeIcon icon={faTags} />}
					description="Add labels to organize and classify this video"
				>
					<DialogTitle className="text-lg text-gray-12">
						Manage Labels
					</DialogTitle>
				</DialogHeader>

				<div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
					{isLoading ? (
						<p className="text-center text-gray-10 py-4">Loading labels...</p>
					) : (
						<>
							{/* AI Classification button */}
							<div className="flex items-center justify-between p-3 rounded-lg bg-gray-3 border border-gray-4">
								<div>
									<p className="text-sm font-medium text-gray-12">
										AI Auto-Classification
									</p>
									<p className="text-xs text-gray-10">
										Let AI suggest labels based on transcription
									</p>
								</div>
								<Button
									variant="gray"
									size="sm"
									onClick={handleClassify}
									disabled={isClassifying}
									spinner={isClassifying}
								>
									{isClassifying ? "Analyzing..." : "✨ Classify"}
								</Button>
							</div>

							{/* Content Type Labels */}
							<div>
								<p className="text-xs font-semibold text-gray-10 uppercase tracking-wide mb-2">
									Content Type
								</p>
								<div className="space-y-1">
									{contentTypeLabels.map((label) => (
										<LabelCheckboxItem
											key={label.id}
											label={label}
											isSelected={selectedLabelIds.has(label.id)}
											onToggle={() => toggleLabel(label.id)}
										/>
									))}
								</div>
							</div>

							{/* Department Labels */}
							<div>
								<p className="text-xs font-semibold text-gray-10 uppercase tracking-wide mb-2">
									Department
								</p>
								<div className="space-y-1">
									{departmentLabels.map((label) => (
										<LabelCheckboxItem
											key={label.id}
											label={label}
											isSelected={selectedLabelIds.has(label.id)}
											onToggle={() => toggleLabel(label.id)}
										/>
									))}
								</div>
							</div>

							{/* Retention Warning */}
							{minRetention !== null && !isKeepPermanently && (
								<div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
									<p className="text-sm text-amber-800 dark:text-amber-200">
										⚠️ This video will be automatically deleted after{" "}
										<strong>{minRetention} days</strong>
									</p>
								</div>
							)}

							{/* Keep Permanently Toggle */}
							{minRetention !== null && (
								<div className="flex items-center justify-between p-3 rounded-lg bg-gray-3">
									<div>
										<p className="text-sm font-medium text-gray-12">
											Keep permanently
										</p>
										<p className="text-xs text-gray-10">
											Override retention and never auto-delete
										</p>
									</div>
									<Switch
										checked={isKeepPermanently}
										onCheckedChange={setIsKeepPermanently}
									/>
								</div>
							)}

							{/* Selected Labels Preview */}
							{selectedLabels.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-gray-10 uppercase tracking-wide mb-2">
										Selected ({selectedLabels.length})
									</p>
									<div className="flex flex-wrap gap-1.5">
										{selectedLabels.map((label) => (
											<VideoLabelBadge
												key={label.id}
												name={label.name}
												displayName={label.displayName}
												color={label.color}
												size="sm"
												onRemove={() => toggleLabel(label.id)}
											/>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<DialogFooter>
					<Button variant="gray" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="dark"
						size="sm"
						onClick={handleSave}
						disabled={isSaving}
						spinner={isSaving}
					>
						{isSaving ? "Saving..." : "Save Labels"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function LabelCheckboxItem({
	label,
	isSelected,
	onToggle,
}: {
	label: AvailableLabel;
	isSelected: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-3 cursor-pointer transition-colors"
			onClick={onToggle}
		>
			<Checkbox checked={isSelected} />
			<div
				className="w-3 h-3 rounded-full flex-shrink-0"
				style={{ backgroundColor: label.color }}
			/>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-gray-12">{label.displayName}</p>
				{label.description && (
					<p className="text-xs text-gray-10 truncate">{label.description}</p>
				)}
			</div>
			{label.retentionDays && (
				<span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
					{label.retentionDays}j
				</span>
			)}
		</div>
	);
}
