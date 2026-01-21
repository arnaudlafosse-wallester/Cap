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
		privacy?: "Public" | "Private";
		parentSpaceId?: string | null;
	} | null;
	onSpaceUpdated?: () => void;
	/** Default privacy for new folders (when not editing) */
	defaultPrivacy?: "Public" | "Private";
	/** Default parent space ID for new folders (when not editing) */
	defaultParentSpaceId?: string | null;
}

const SpaceDialog = ({
	open,
	onClose,
	edit = false,
	space,
	onSpaceUpdated,
	defaultPrivacy,
	defaultParentSpaceId,
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
							? "Edit your folder details"
							: "A new folder for your team to collaborate"
					}
				>
					<DialogTitle className="text-lg text-gray-12">
						{edit ? "Edit Folder" : "Create New Folder"}
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
						defaultPrivacy={defaultPrivacy}
						defaultParentSpaceId={defaultParentSpaceId}
					/>
				</div>
				<DialogFooter>
					{!spaceName.trim().length && (
						<p className="text-xs text-gray-10 mr-auto ml-4">
							Enter a folder name to continue
						</p>
					)}
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
		privacy?: "Public" | "Private";
		parentSpaceId?: string | null;
	} | null;
	/** Default privacy for new folders (when not editing) */
	defaultPrivacy?: "Public" | "Private";
	/** Default parent space ID for new folders (when not editing) */
	defaultParentSpaceId?: string | null;
}

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Folder name is required")
		.max(25, "Folder name must be at most 25 characters"),
	members: z.array(z.string()).optional(),
	privacy: z.enum(["Public", "Private"]).default("Private"),
	parentSpaceId: z.string().nullable().optional(),
});

export const NewSpaceForm: React.FC<NewSpaceFormProps> = (props) => {
	const { edit = false, space, defaultPrivacy, defaultParentSpaceId } = props;
	const router = useRouter();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: space?.name || "",
			members: space?.members || [],
			privacy: space?.privacy || defaultPrivacy || "Private",
			parentSpaceId: space?.parentSpaceId || defaultParentSpaceId || null,
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
			form.reset({
				name: "",
				members: [],
				privacy: defaultPrivacy || "Private",
				parentSpaceId: defaultParentSpaceId || null,
			});
		}
	}, [space, form]);

	const { activeOrganization, spacesData, user } = useDashboardContext();

	// Check if current user is the organization owner
	const isOwner = activeOrganization?.organization.ownerId === user?.id;

	// Watch the privacy field to filter parent spaces accordingly
	const currentPrivacy = form.watch("privacy");

	// Filter parent spaces based on selected privacy type
	// Shared (Public) spaces can only be nested under other Shared spaces
	// Private spaces can only be nested under other Private spaces
	// Non-owners cannot create level 1 folders (directly under primary/Shared)
	const availableParentSpaces = spacesData?.filter(s => {
		// Can't be its own parent
		if (s.id === space?.id) return false;

		// Non-owners cannot select the primary space (prevents creating level 1 folders)
		if (!isOwner && s.primary) return false;

		if (currentPrivacy === "Public") {
			// For Shared spaces: show primary space and all Public spaces
			return s.primary || s.privacy === "Public";
		} else {
			// For Private spaces: show only Private spaces (excluding primary)
			return !s.primary && s.privacy === "Private";
		}
	}) || [];

	// Build hierarchical list of parent spaces with depth for indentation
	const buildHierarchicalOptions = () => {
		if (!availableParentSpaces.length) return [];

		// Build map of children by parentId
		const childrenMap = new Map<string | null, typeof availableParentSpaces>();
		for (const s of availableParentSpaces) {
			const parent = s.parentSpaceId || null;
			childrenMap.set(parent, [...(childrenMap.get(parent) || []), s]);
		}

		// Build flat list with depth
		const result: { space: (typeof availableParentSpaces)[0]; depth: number }[] = [];

		const addChildren = (parentId: string | null, depth: number) => {
			const children = childrenMap.get(parentId) || [];
			for (const child of children) {
				result.push({ space: child, depth });
				addChildren(child.id, depth + 1);
			}
		};

		// For Shared: start with primary space (organizationId)
		const primary = availableParentSpaces.find(s => s.primary);
		if (primary) {
			result.push({ space: primary, depth: 0 });
			addChildren(primary.id, 1);
		} else {
			// For Private: start from root (null parent)
			addChildren(null, 0);
		}

		return result;
	};

	// Auto-set parentSpaceId when privacy changes
	useEffect(() => {
		const primarySpace = spacesData?.find(s => s.primary);
		const currentParentId = form.getValues("parentSpaceId");

		if (currentPrivacy === "Public") {
			// When switching to Shared: if no parent selected, auto-select primary space
			if (!currentParentId && primarySpace) {
				form.setValue("parentSpaceId", primarySpace.id);
			} else if (currentParentId) {
				// Validate existing parent is still valid for Public
				const parentSpace = spacesData?.find(s => s.id === currentParentId);
				if (parentSpace && !parentSpace.primary && parentSpace.privacy !== "Public") {
					form.setValue("parentSpaceId", primarySpace?.id || null);
				}
			}
		} else {
			// When switching to Private: clear if parent was primary space
			if (currentParentId === primarySpace?.id) {
				form.setValue("parentSpaceId", null);
			} else if (currentParentId) {
				// Validate existing parent is still valid for Private
				const parentSpace = spacesData?.find(s => s.id === currentParentId);
				if (parentSpace && (parentSpace.primary || parentSpace.privacy !== "Private")) {
					form.setValue("parentSpaceId", null);
				}
			}
		}
	}, [currentPrivacy, spacesData, form]);

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				ref={props.formRef}
				onSubmit={form.handleSubmit(async (values) => {
					try {
						props.setCreateLoading?.(true);

						const formData = new FormData();
						formData.append("name", values.name);
						formData.append("privacy", values.privacy);

						// Auto-set parentSpaceId for Shared folders without explicit parent
						let parentSpaceIdToSave = values.parentSpaceId;
						if (values.privacy === "Public" && !values.parentSpaceId) {
							const primarySpace = spacesData?.find(s => s.primary);
							if (primarySpace) {
								parentSpaceIdToSave = primarySpace.id;
							}
						}

						if (parentSpaceIdToSave) {
							formData.append("parentSpaceId", parentSpaceIdToSave);
						}

						if (values.members && values.members.length > 0) {
							values.members.forEach((id) => {
								formData.append("members[]", id);
							});
						}

						if (edit && space?.id) {
							formData.append("id", space.id);
							const result = await updateSpace(formData);
							if (!result.success) {
								throw new Error(result.error || "Failed to update folder");
							}
							toast.success("Folder updated successfully");
							router.refresh();
						} else {
							const result = await createSpace(formData);
							if (!result.success) {
								throw new Error(result.error || "Failed to create folder");
							}
							toast.success("Folder created successfully");
							router.refresh();
						}

						form.reset();
						props.onSpaceCreated();
					} catch (error: any) {
						console.error(
							edit ? "Error updating space:" : "Error creating space:",
							error,
						);
						toast.error(
							error?.message ||
								error?.error ||
								(edit ? "Failed to update folder" : "Failed to create folder"),
						);
					} finally {
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
									placeholder="Folder name"
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
									<Label htmlFor="privacy">
									{field.value === "Public" ? "Shared Folder" : "Private Folder"}
								</Label>
									<CardDescription className="text-xs">
										{field.value === "Public"
											? "All organization members can see this folder"
											: "Only invited members can see this folder"}
									</CardDescription>
								</div>
								<FormControl>
									<Switch
										id="privacy"
										checked={field.value === "Public"}
										onCheckedChange={(checked) =>
											field.onChange(checked ? "Public" : "Private")
										}
										className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-blue-500"
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
									<Label htmlFor="parentSpace">Parent Folder (optional)</Label>
									<CardDescription className="text-xs">
										Nest this folder under another folder
									</CardDescription>
									<FormControl>
										<select
											id="parentSpace"
											className="w-full p-2 rounded-lg border border-gray-6 bg-gray-2 text-gray-12 text-sm"
											value={field.value || ""}
											onChange={(e) => field.onChange(e.target.value || null)}
										>
											{/* Only show "No parent" for Private folders - Shared folders must have a parent */}
											{currentPrivacy === "Private" && (
												<option value="">No parent (top-level)</option>
											)}
											{buildHierarchicalOptions().map(({ space, depth }) => (
												<option key={space.id} value={space.id}>
													{'\u00A0'.repeat(depth * 4)}{depth > 0 ? '└─ ' : ''}{space.name}
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
									Add team members to this folder.
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
				</div>
			</form>
		</Form>
	);
};

export default SpaceDialog;
