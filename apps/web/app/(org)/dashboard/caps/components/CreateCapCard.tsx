"use client";

import { Button } from "@cap/ui";
import { faDownload, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MonitorIcon, PlayCircle } from "lucide-react";
import { useCapDesktopDetection } from "./useCapDesktopDetection";

export const CreateCapCard = () => {
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();

	return (
		<div className="flex relative overflow-hidden flex-col gap-4 w-full h-full rounded-xl bg-gray-1 border-2 border-dashed border-gray-4 hover:border-gray-6 transition-colors duration-200">
			<div className="relative aspect-video w-full flex items-center justify-center bg-gray-2">
				<div className="flex flex-col items-center gap-2">
					<div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-3">
						<FontAwesomeIcon icon={faPlus} className="size-5 text-gray-10" />
					</div>
					<p className="text-sm font-medium text-gray-10">Create a new video</p>
				</div>
			</div>
			<div className="flex flex-col flex-grow gap-3 px-4 pb-4 w-full">
				<div className="flex flex-col gap-2">
					{isInstalled === true ? (
						<Button
							onClick={openDesktop}
							disabled={isChecking}
							className="flex relative gap-2 justify-center items-center w-full"
							variant="dark"
							size="sm"
						>
							<PlayCircle className="size-3.5" />
							{isChecking ? "Opening..." : "Open Cap Desktop"}
						</Button>
					) : (
						<Button
							href="/download"
							className="flex relative gap-2 justify-center items-center w-full"
							variant="dark"
							size="sm"
						>
							<FontAwesomeIcon className="size-3.5" icon={faDownload} />
							Download Cap
						</Button>
					)}
					<Button
						href="/dashboard/caps/record"
						variant="blue"
						size="sm"
						className="flex items-center justify-center gap-2 w-full"
					>
						<MonitorIcon className="size-3.5" />
						Record in Browser
					</Button>
				</div>
			</div>
		</div>
	);
};
