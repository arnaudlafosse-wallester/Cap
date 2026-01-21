import { Button } from "@cap/ui";
import { faDownload, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRive } from "@rive-app/react-canvas";
import { PlayCircle } from "lucide-react";
import { useTheme } from "../../../Contexts";
import { useCapDesktopDetection } from "../../../caps/components/useCapDesktopDetection";
import { WebRecorderDialog } from "../../../caps/components/web-recorder-dialog/web-recorder-dialog";

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
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();
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
		<div className="flex flex-col flex-1 justify-center items-center w-full h-full">
			<div className="mx-auto mb-6 w-full max-w-sm">
				<EmptyCap
					key={`${theme}empty-shared-cap`}
					className="max-w-[180px] w-full mx-auto md:max-w-[240px] h-[120px]"
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
						? "Add videos directly here in this Folder, or add videos from My Recordings."
						: `There are no Caps shared with ${organizationName} yet. Ask your team members to share their Caps with this ${type}.`}
				</p>
				<div className="flex flex-wrap gap-3 justify-center items-center">
					{headerActions}
					{showAddButton && (
						<>
							<Button
								onClick={onAddVideos}
								variant="dark"
								size="lg"
								className="flex gap-2 items-center"
							>
								<FontAwesomeIcon icon={faPlus} className="size-3.5" />
								Add videos to {type === "space" ? "Folder" : "Organization"}
							</Button>
							<p className="text-sm text-gray-10">or</p>
						</>
					)}
					{isInstalled === true ? (
						<Button
							onClick={openDesktop}
							disabled={isChecking}
							variant="primary"
							size="lg"
							className="flex gap-2 items-center"
						>
							<PlayCircle className="size-3.5" />
							{isChecking ? "Opening..." : "Open Cap Desktop"}
						</Button>
					) : (
						<Button
							href="/download"
							variant="primary"
							size="lg"
							className="flex gap-2 items-center"
						>
							<FontAwesomeIcon className="size-3.5" icon={faDownload} />
							Download Cap
						</Button>
					)}
					<p className="text-sm text-gray-10">or</p>
					<WebRecorderDialog />
				</div>
			</div>
		</div>
	);
};
