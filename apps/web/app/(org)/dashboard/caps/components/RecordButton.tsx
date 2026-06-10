"use client";

import { Button } from "@cap/ui";
import { HelpCircle, MonitorIcon, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useCapDesktopDetection } from "./useCapDesktopDetection";
import { WebRecorderDialog } from "./web-recorder-dialog/web-recorder-dialog";

const SETUP_GUIDE_URL =
	"https://wallyhelp.com/app/kb/configurer-cap-pour-wallester-record";

export const RecordButton = () => {
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();
	const [recorderOpen, setRecorderOpen] = useState(false);

	return (
		<>
			<div className="flex flex-col gap-1 items-center">
				<Button
					onClick={
						isInstalled === false
							? () => window.open("/download", "_blank")
							: openDesktop
					}
					disabled={isChecking}
					variant="blue"
					size="sm"
					className="flex items-center gap-2 whitespace-nowrap"
				>
					<PlayCircle className="size-3.5" />
					{isChecking
						? "Opening..."
						: isInstalled === false
							? "Get Cap App"
							: "Open Cap"}
				</Button>
				{isInstalled !== true && (
					<a
						href={SETUP_GUIDE_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex gap-1 items-center text-[11px] text-blue-11 hover:underline dark:text-blue-10"
					>
						<HelpCircle className="size-3" />
						Not installed? View setup guide
					</a>
				)}
			</div>

			<WebRecorderDialog
				hideTrigger
				externalOpen={recorderOpen}
				onExternalOpenChange={setRecorderOpen}
			/>
			<Button
				onClick={() => setRecorderOpen(true)}
				variant="green"
				size="sm"
				className="flex items-center gap-2 whitespace-nowrap"
			>
				<MonitorIcon className="size-3.5" />
				Record in Browser
			</Button>
		</>
	);
};
