"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cap/ui";
import { ChevronDown, MonitorIcon, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useCapDesktopDetection } from "./useCapDesktopDetection";
import { WebRecorderDialog } from "./web-recorder-dialog/web-recorder-dialog";

export const RecordButton = () => {
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();
	const [recorderOpen, setRecorderOpen] = useState(false);

	// Confirmed installed (previous successful launch stored in localStorage)
	// → single "Record" button that launches the app directly
	if (isInstalled === true) {
		return (
			<Button
				onClick={openDesktop}
				disabled={isChecking}
				variant="blue"
				size="sm"
				className="flex items-center gap-2"
			>
				<PlayCircle className="size-3.5" />
				{isChecking ? "Opening..." : "Record"}
			</Button>
		);
	}

	// Not confirmed or unknown → dropdown with both options
	// (Zoom/Slack/Figma pattern: always show both, don't try to detect)
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="blue"
						size="sm"
						className="flex items-center gap-2"
					>
						<MonitorIcon className="size-3.5" />
						Record
						<ChevronDown className="size-3 ml-0.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onClick={openDesktop}
						className="rounded-lg"
					>
						<PlayCircle className="mr-1.5 size-3 text-gray-10" />
						Open Cap Desktop
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setRecorderOpen(true)}
						className="rounded-lg"
					>
						<MonitorIcon className="mr-1.5 size-3 text-gray-10" />
						Record in Browser
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<WebRecorderDialog
				hideTrigger
				externalOpen={recorderOpen}
				onExternalOpenChange={setRecorderOpen}
			/>
		</>
	);
};
