import { Button } from "@cap/ui";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRive } from "@rive-app/react-canvas";
import { useTheme } from "../../../Contexts";

interface EmptySharedCapStateProps {
	organizationName: string;
	type?: "space" | "organization";
	spaceData?: {
		id: string;
		name: string;
		organizationId: string;
		createdById: string;
	};
	currentUserId?: string;
	onAddVideos?: () => void;
	headerActions?: React.ReactNode;
}

export const EmptySharedCapState: React.FC<EmptySharedCapStateProps> = ({
	organizationName,
	type = "organization",
	spaceData,
	currentUserId,
	onAddVideos,
	headerActions,
}) => {
	const { theme } = useTheme();
	const { RiveComponent: EmptyCap } = useRive({
		src: "/rive/main.riv",
		artboard: theme === "light" ? "emptyshared" : "darkemptyshared",
		autoplay: true,
	});

	const isSpaceOwner = spaceData?.createdById === currentUserId;
	const showAddButton =
		(type === "space" && isSpaceOwner && onAddVideos) ||
		(type === "organization" && onAddVideos);

	return (
		<div className="flex flex-col flex-1 justify-center items-center w-full h-full min-h-[60vh]">
			<div className="mx-auto mb-8 w-full max-w-sm">
				<EmptyCap
					key={`${theme}empty-shared-cap`}
					className="max-w-[200px] w-full mx-auto md:max-w-[300px] h-[150px]"
				/>
			</div>
			<div className="text-center">
				<p className="mb-3 text-xl font-semibold text-gray-12">
					{type === "space"
						? "Start sharing videos to this Folder"
						: "No shared Caps yet!"}
				</p>
				<p className="mb-6 max-w-md text-md text-gray-10">
					{type === "space"
						? "Add videos directly here in this Folder, or add videos from the My Caps page."
						: `There are no Caps shared with ${organizationName} yet. Ask your team members to share their Caps with this ${type}.`}
				</p>
				<div className="flex flex-wrap gap-3 justify-center items-center">
					{headerActions}
					{showAddButton && (
						<Button
							onClick={onAddVideos}
							variant="dark"
							size="lg"
							className="flex gap-2 items-center"
						>
							<FontAwesomeIcon icon={faPlus} className="size-3.5" />
							Add videos to {type === "space" ? "Folder" : "Organization"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};
