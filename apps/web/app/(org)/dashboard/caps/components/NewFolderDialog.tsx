"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
} from "@cap/ui";
import type { Folder, Space } from "@cap/web-domain";
import { faFolder, faFolderPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { Option } from "effect";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useEffectMutation, useRpcClient } from "@/lib/EffectRuntime";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId?: Space.SpaceIdOrOrganisationId;
}

// Simple static folder icons with colors
const FolderIcon = ({ color }: { color: string }) => (
	<div className="w-[50px] h-[50px] flex items-center justify-center">
		<FontAwesomeIcon icon={faFolder} className="size-10" style={{ color }} />
	</div>
);

const FolderOptions = [
	{
		value: "normal",
		label: "Normal",
		color: "#9CA3AF", // gray
	},
	{
		value: "blue",
		label: "Blue",
		color: "#3B82F6", // blue
	},
	{
		value: "red",
		label: "Red",
		color: "#EF4444", // red
	},
	{
		value: "yellow",
		label: "Yellow",
		color: "#F59E0B", // yellow/amber
	},
] as const;

export const NewFolderDialog: React.FC<Props> = ({
	open,
	onOpenChange,
	spaceId,
}) => {
	const [selectedColor, setSelectedColor] = useState<
		(typeof FolderOptions)[number]["value"] | null
	>(null);
	const [folderName, setFolderName] = useState<string>("");
	const router = useRouter();

	useEffect(() => {
		if (!open) setSelectedColor(null);
	}, [open]);

	const rpc = useRpcClient();

	const createFolder = useEffectMutation({
		mutationFn: (data: { name: string; color: Folder.FolderColor }) =>
			rpc.FolderCreate({
				name: data.name,
				color: data.color,
				spaceId: Option.fromNullable(spaceId),
				parentId: Option.none(),
			}),
		onSuccess: () => {
			setFolderName("");
			setSelectedColor(null);
			onOpenChange(false);
			router.refresh();
			toast.success("Folder created successfully");
		},
		onError: () => {
			toast.error("Failed to create folder");
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100%-20px)]">
				<DialogHeader
					icon={<FontAwesomeIcon icon={faFolderPlus} className="size-3.5" />}
				>
					<DialogTitle>New Folder</DialogTitle>
				</DialogHeader>
				<div className="p-5">
					<Input
						value={folderName}
						onChange={(e) => setFolderName(e.target.value)}
						required
						placeholder="Folder name"
					/>
					<div className="flex flex-wrap gap-2 mt-3">
						{FolderOptions.map((option) => {
							return (
								<div
									className={clsx(
										"flex flex-col flex-1 gap-1 items-center p-2 rounded-xl border transition-colors duration-200 cursor-pointer",
										selectedColor === option.value
											? "border-gray-12 bg-gray-3 hover:bg-gray-3 hover:border-gray-12"
											: "border-gray-4 hover:bg-gray-3 hover:border-gray-5 bg-transparent",
									)}
									key={`folder-${option.value}`}
									onClick={() => {
										if (selectedColor === option.value) {
											setSelectedColor(null);
											return;
										}
										setSelectedColor(option.value);
									}}
								>
									<FolderIcon color={option.color} />
									<p className="text-xs text-gray-10">{option.label}</p>
								</div>
							);
						})}
					</div>
				</div>
				<DialogFooter>
					<Button size="sm" variant="gray" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							if (selectedColor === null) return;
							createFolder.mutate({ name: folderName, color: selectedColor });
						}}
						size="sm"
						spinner={createFolder.isPending}
						variant="dark"
						disabled={
							!selectedColor ||
							!folderName.trim().length ||
							createFolder.isPending
						}
					>
						{createFolder.isPending ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
