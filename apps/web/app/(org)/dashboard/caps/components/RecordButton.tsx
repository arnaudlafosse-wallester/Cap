"use client";

import { Button } from "@cap/ui";
import { MonitorIcon, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useCapDesktopDetection } from "./useCapDesktopDetection";
import { WebRecorderDialog } from "./web-recorder-dialog/web-recorder-dialog";

export const RecordButton = () => {
	const { isInstalled, isChecking, openDesktop } = useCapDesktopDetection();
	const [recorderOpen, setRecorderOpen] = useState(false);

	return (
		<>
			{/* Button 1: Open Cap Desktop app */}
			<Button
				onClick={
					isInstalled === false
						? () => window.open("/download", "_blank")
						: openDesktop
				}
				disabled={isChecking}
				variant="blue"
				size="sm"
				className="flex items-center gap-2"
			>
				<PlayCircle className="size-3.5" />
				{isChecking
					? "Opening..."
					: isInstalled === false
						? "Get Cap App"
						: "Open Cap"}
			</Button>

			{/* Button 2: Record in Browser (always same) */}
			<WebRecorderDialog
				hideTrigger
				externalOpen={recorderOpen}
				onExternalOpenChange={setRecorderOpen}
			/>
			<Button
				onClick={() => setRecorderOpen(true)}
				variant="green"
				size="sm"
				className="flex items-center gap-2"
			>
				<MonitorIcon className="size-3.5" />
				Record in Browser
			</Button>
		</>
	);
};
