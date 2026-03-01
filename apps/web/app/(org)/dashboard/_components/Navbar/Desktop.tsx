"use client";
import { Button } from "@cap/ui";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useDetectPlatform } from "hooks/useDetectPlatform";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { useDashboardContext } from "../../Contexts";
import AdminNavItems from "./Items";

export const DesktopNav = () => {
	const { toggleSidebarCollapsed, sidebarCollapsed } = useDashboardContext();
	const { platform } = useDetectPlatform();
	const cmdSymbol = platform === "macos" ? "⌘" : "Ctrl";
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "s" &&
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey
			) {
				event.preventDefault();
				toggleSidebarCollapsed();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebarCollapsed]);

	return (
		<motion.aside
			initial={false}
			animate={{
				width: sidebarCollapsed ? 70 : 260,
				transition: {
					duration: 0.6,
					type: "spring",
					bounce: 0.25,
				},
			}}
			className={clsx(
				"hidden relative z-50 flex-1 h-full [grid-area:sidebar] will-change-[width] lg:flex group bg-gray-2 border-r border-gray-4",
			)}
		>
			<div className="flex flex-col mx-auto w-full h-full">
				<div className="h-12 flex items-center gap-2 px-3 w-full border-b border-gray-4">
					{!sidebarCollapsed && (
						<div className="relative flex-1">
							<Search
								size={14}
								className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-9 pointer-events-none"
							/>
							<input
								type="text"
								placeholder="Search..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full h-8 pl-7 pr-2 text-sm bg-gray-3 border border-gray-4 rounded-md text-gray-12 placeholder:text-gray-9 outline-none focus:border-gray-6 transition-colors"
							/>
						</div>
					)}
					<Tooltip
						kbd={[cmdSymbol, "Shift", "S"]}
						position="right"
						content={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						<Button
							variant="white"
							onClick={toggleSidebarCollapsed}
							className="size-7 p-0 min-w-[unset] rounded-full transition-all z-10 flex-shrink-0"
						>
							<ChevronRight
								size={14}
								className={clsx(
									"transition-transform duration-200 text-gray-12",
									!sidebarCollapsed && "rotate-180",
								)}
							/>
						</Button>
					</Tooltip>
				</div>
				<div className="flex overflow-y-auto flex-col flex-grow">
					<div className="flex flex-col px-1.5 h-full">
						<AdminNavItems />
					</div>
				</div>
			</div>
		</motion.aside>
	);
};

export default DesktopNav;
