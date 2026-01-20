"use client";

import {
	Button,
	CardDescription,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Form,
	FormControl,
	FormField,
	Input,
	Label,
	Switch,
} from "@cap/ui";
import type { ImageUpload } from "@cap/web-domain";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { updateSpace } from "@/actions/organization/update-space";
import { FileInput } from "@/components/FileInput";
import { useDashboardContext } from "../../Contexts";
import { MemberSelect } from "../../spaces/[spaceId]/components/MemberSelect";
import { createSpace } from "./server";

interface SpaceDialogProps {
	open: boolean;
	onClose: () => void;
	edit?: boolean;
	space?: {
		id: string;
		name: string;
		members: string[];
		iconUrl?: ImageUpload.ImageUrl;
		privacy?: "Public" | "Private";
		parentSpaceId?: string | null;
	} | null;
	onSpaceUpdated?: () => void;
}

const SpaceDialog = ({
	open,
	onClose,
	edit = false,
	space,
	onSpaceUpdated,
}: SpaceDialogProps) => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const formRef = useRef<HTMLFormElement | null>(null);
	const [spaceName, setSpaceName] = useState(space?.name || "");

	useEffect(() => {
		setSpaceName(space?.name || "");
	}, [space]);

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="p-0 w-[calc(100%-20px)] max-w-md rounded-xl border bg-gray-2 border-gray-4">
				<DialogHeader
					icon={<FontAwesomeIcon icon={faLayerGroup} />}
					description={
						edit
							? "Edit your space details"
							: "A new space for your team to collaborate"
					}
				>
					<DialogTitle className="text-lg text-gray-12">
						{edit ? "Edit Space" : "Create New Space"}
					</DialogTitle>
				</DialogHeader>
				<div className="p-5">
					<NewSpaceForm
						formRef={formRef}
						setCreateLoading={setIsSubmitting}
						onSpaceCreated={onSpaceUpdated || onClose}
						onNameChange={setSpaceName}
						edit={edit}
						space={space}
					/>
				</div>
				<DialogFooter>
					<Button variant="gray" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="dark"
						size="sm"
						disabled={isSubmitting || !spaceName.trim().length}
						spinner={isSubmitting}
						onClick={() => formRef.current?.requestSubmit()}
					>
						{isSubmitting
							? edit
								? "Saving..."
								: "Creating..."
							: edit
								? "Save"
								: "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export interface NewSpaceFormProps {
	onSpaceCreated: () => void;
	formRef?: React.RefObject<HTMLFormElement | null>;
	setCreateLoading?: React.Dispatch<React.SetStateAction<boolean>>;
	onNameChange?: (name: string) => void;
	edit?: boolean;
	space?: {
		id: string;
		name: string;
		members: string[];
		iconUrl?: ImageUpload.ImageUrl;
		privacy?: "Public" | "Private";
		parentSpaceId?: string | null;
	} | null;
}

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Space name is required")
		.max(25, "Space name must be at most 25 characters"),
	members: z.array(z.string()).optional(),
	privacy: z.enum(["Public", "Private"]).default("Private"),
	parentSpaceId: z.string().nullable().optional(),
});

export const NewSpaceForm: React.FC<NewSpaceFormProps> = (props) => {
	const { edit = false, space } = props;
	const router = useRouter();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: space?.name || "",
			members: space?.members || [],
			privacy: space?.privacy || "Private",
			parentSpaceId: space?.parentSpaceId || null,
		},
		mode: "onChange",
	});

	useEffect(() => {
		if (space) {
			form.reset({
				name: space.name,
				members: space.members,
				privacy: space.privacy || "Private",
				parentSpaceId: space.parentSpaceId || null,
			});
		} else {
			form.reset({ name: "", members: [], privacy: "Private", parentSpaceId: null });
		}
	}, [space, form]);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const { activeOrganization, spacesData } = useDashboardContext();

	// Filter out the current space and its children from parent options
	// Allow any space without a parent (top-level) to be a potential parent
	const availableParentSpaces = spacesData?.filter(s =>
		s.id !== space?.id && // Can't be its own parent
		!s.parentSpaceId // Only top-level spaces can be parents (including primary "All Wallester")
	) || [];

	const handleFileChange = (file: File | null) => {
		if (file) {
			// Validate file size (1MB = 1024 * 1024 bytes)
			if (file.size > 1024 * 1024) {
				toast.error("File size must be less than 1MB");
				return;
			}
			// Validate file type
			if (!file.type.startsWith("image/")) {
				toast.error("File must be an image");
				return;
			}
		}
		setSelectedFile(file);
	};

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				ref={props.formRef}
				onSubmit={form.handleSubmit(async (values) => {
					try {
						if (selectedFile) {
							setIsUploading(true);
						}
						props.setCreateLoading?.(true);

						const formData = new FormData();
						formData.append("name", values.name);
						formData.append("privacy", values.privacy);
						if (values.parentSpaceId) {
							formData.append("parentSpaceId", values.parentSpaceId);
						}

						if (selectedFile) {
							formData.append("icon", selectedFile);
						}

						if (values.members && values.members.length > 0) {
							values.members.forEach((id) => {
								formData.append("members[]", id);
							});
						}

						if (edit && space?.id) {
							formData.append("id", space.id);
							// If the user removed the icon, send a removeIcon flag
							if (selectedFile === null && space.iconUrl) {
								formData.append("removeIcon", "true");
							}
							const result = await updateSpace(formData);
							if (!result.success) {
								throw new Error(result.error || "Failed to update space");
							}
							toast.success("Space updated successfully");
							router.refresh();
						} else {
							const result = await createSpace(formData);
							if (!result.success) {
								throw new Error(result.error || "Failed to create space");
							}
							toast.success("Space created successfully");
							router.refresh();
						}

						form.reset();
						setSelectedFile(null);
						props.onSpaceCreated();
					} catch (error: any) {
						console.error(
							edit ? "Error updating space:" : "Error creating space:",
							error,
						);
						toast.error(
							error?.message ||
								error?.error ||
								(edit ? "Failed to update space" : "Failed to create space"),
						);
					} finally {
						setIsUploading(false);
						props.setCreateLoading?.(false);
					}
				})}
			>
				<div className="space-y-4">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormControl>
								<Input
									placeholder="Space name"
									maxLength={25}
									{...field}
									onChange={(e) => {
										field.onChange(e);
										props.onNameChange?.(e.target.value);
									}}
								/>
							</FormControl>
						)}
					/>

					{/* Privacy Toggle */}
					<FormField
						control={form.control}
						name="privacy"
						render={({ field }) => (
							<div className="flex items-center justify-between p-3 rounded-lg bg-gray-3">
								<div className="space-y-0.5">
									<Label htmlFor="privacy">Private Space</Label>
									<CardDescription className="text-xs">
										{field.value === "Private"
											? "Only invited members can see this space"
											: "All organization members can see this space"}
									</CardDescription>
								</div>
								<FormControl>
									<Switch
										id="privacy"
										checked={field.value === "Private"}
										onCheckedChange={(checked) =>
											field.onChange(checked ? "Private" : "Public")
										}
									/>
								</FormControl>
							</div>
						)}
					/>

					{/* Parent Space Selector */}
					{availableParentSpaces.length > 0 && (
						<FormField
							control={form.control}
							name="parentSpaceId"
							render={({ field }) => (
								<div className="space-y-1">
									<Label htmlFor="parentSpace">Parent Space (optional)</Label>
									<CardDescription className="text-xs">
										Nest this space under another space
									</CardDescription>
									<FormControl>
										<select
											id="parentSpace"
											className="w-full p-2 rounded-lg border border-gray-6 bg-gray-2 text-gray-12 text-sm"
											value={field.value || ""}
											onChange={(e) => field.onChange(e.target.value || null)}
										>
											<option value="">No parent (top-level)</option>
											{availableParentSpaces.map((s) => (
												<option key={s.id} value={s.id}>
													{s.name}
												</option>
											))}
										</select>
									</FormControl>
								</div>
							)}
						/>
					)}

					{/* Space Members Input - Only show for Private spaces */}
					{form.watch("privacy") === "Private" && (
						<>
							<div className="space-y-1">
								<Label htmlFor="members">Members</Label>
								<CardDescription className="w-full max-w-[400px]">
									Add team members to this space.
								</CardDescription>
							</div>
							<FormField
								control={form.control}
								name="members"
								render={({ field }) => {
									return (
										<FormControl>
											<MemberSelect
												placeholder="Add member..."
												showEmptyIfNoMembers={false}
												disabled={isUploading}
												canManageMembers={true}
												selected={(activeOrganization?.members ?? [])
													.filter((m) => (field.value ?? []).includes(m.user.id))
													.map((m) => ({
														value: m.user.id,
														label: m.user.name || m.user.email,
														image: m.user.image ?? undefined,
													}))}
												onSelect={(selected) =>
													field.onChange(selected.map((opt) => opt.value))
												}
											/>
										</FormControl>
									);
								}}
							/>
						</>
					)}

					<div className="space-y-1">
						<Label htmlFor="icon">Space Icon</Label>
						<CardDescription className="w-full max-w-[400px]">
							Upload a custom logo or icon for your space (max 1MB).
						</CardDescription>
					</div>

					<div className="relative mt-2">
						<FileInput
							id="space-icon"
							name="icon"
							initialPreviewUrl={space?.iconUrl || null}
							notDraggingClassName="hover:bg-gray-3"
							onChange={handleFileChange}
							disabled={isUploading}
							isLoading={isUploading}
						/>
					</div>
				</div>
			</form>
		</Form>
	);
};

export default SpaceDialog;
