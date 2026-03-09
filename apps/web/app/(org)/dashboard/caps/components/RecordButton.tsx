"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cap/ui";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ChevronDown, MonitorIcon, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useCapDesktopDetection } from "./useCapDesktopDetection";
import { WebRecorderDialog } from "./web-recorder-dialog/web-recorder-dialog";

export const RecordButton = () => {
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();
	const [recorderOpen, setRecorderOpen] = useState(false);

	// Desktop app installed → single "Record" button that launches the app
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

	// Desktop not installed or unknown → dropdown with options
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
						onClick={() => setRecorderOpen(true)}
						className="rounded-lg"
					>
						<MonitorIcon className="mr-1.5 size-3 text-gray-10" />
						Record in Browser
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => window.open("/download", "_self")}
						className="rounded-lg"
					>
						<FontAwesomeIcon
							className="mr-1.5 size-3 text-gray-10"
							icon={faDownload}
						/>
						Download Cap Desktop
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
