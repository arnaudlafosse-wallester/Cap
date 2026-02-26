"use client";
import { Button } from "@cap/ui";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useDetectPlatform } from "hooks/useDetectPlatform";
import { ChevronRight, Video } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Tooltip } from "@/components/Tooltip";
import { useDashboardContext } from "../../Contexts";
import AdminNavItems from "./Items";

export const DesktopNav = () => {
	const { toggleSidebarCollapsed, sidebarCollapsed } = useDashboardContext();
	const { platform } = useDetectPlatform();
	const cmdSymbol = platform === "macos" ? "⌘" : "Ctrl";

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
				<div className="h-12 flex items-center justify-between px-3 w-full border-b border-gray-4">
					<Link
						href="/dashboard"
						className={clsx(
							"flex items-center gap-2 text-gray-12",
							sidebarCollapsed && "justify-center w-full",
						)}
					>
						<Video size={18} className="flex-shrink-0" />
						{!sidebarCollapsed && (
							<span className="font-semibold text-sm truncate">
								Wallester Record
							</span>
						)}
					</Link>
					{!sidebarCollapsed && (
						<Tooltip
							kbd={[cmdSymbol, "Shift", "S"]}
							position="right"
							content="Collapse sidebar"
						>
							<Button
								variant="white"
								onClick={toggleSidebarCollapsed}
								className="size-7 p-0 min-w-[unset] rounded-full transition-all z-10 opacity-0 group-hover:opacity-100"
							>
								<ChevronRight
									size={14}
									className="transition-transform duration-200 text-gray-12 rotate-180"
								/>
							</Button>
						</Tooltip>
					)}
					{sidebarCollapsed && (
						<Tooltip
							kbd={[cmdSymbol, "Shift", "S"]}
							position="right"
							content="Expand sidebar"
						>
							<Button
								variant="white"
								onClick={toggleSidebarCollapsed}
								className="size-7 p-0 min-w-[unset] rounded-full transition-all z-10 absolute right-0 top-3 opacity-0 group-hover:opacity-100"
							>
								<ChevronRight
									size={14}
									className="transition-transform duration-200 text-gray-12"
								/>
							</Button>
						</Tooltip>
					)}
				</div>
				<div className="flex overflow-y-auto flex-col flex-grow">
					<div className="flex flex-col px-3 h-full">
						<AdminNavItems />
					</div>
				</div>
			</div>
		</motion.aside>
	);
};

export default DesktopNav;
