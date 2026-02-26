"use client";
import { classNames } from "@cap/utils";
import clsx from "clsx";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cloneElement, type RefObject, useRef } from "react";
import { Tooltip } from "@/components/Tooltip";
// UsageButton removed for self-hosted version
import { useDashboardContext } from "../../Contexts";
import { CapIcon, ChartLineIcon, CogIcon, RecordIcon } from "../AnimatedIcons";
import type { CogIconHandle } from "../AnimatedIcons/Cog";
import SpacesList from "./SpacesList";

interface Props {
	toggleMobileNav?: () => void;
}

const AdminNavItems = ({ toggleMobileNav }: Props) => {
	const pathname = usePathname();
	const { user, sidebarCollapsed, userCapsCount } = useDashboardContext();

	// Admin email that can access Organization Settings
	const adminEmail = "arnaud.lafosse@wallester.com";
	const isAdmin = user.email === adminEmail;

	const manageNavigation = [
		{
			name: "My Recordings",
			href: `/dashboard/caps`,
			extraText: userCapsCount,
			icon: <CapIcon />,
			subNav: [],
		},
		{
			name: "Analytics",
			href: `/dashboard/analytics`,
			matchChildren: true,
			icon: <ChartLineIcon />,
			subNav: [],
		},
		{
			name: "Record a Video",
			href: `/dashboard/caps/record`,
			icon: <RecordIcon />,
			subNav: [],
		},
	];

	const isPathActive = (path: string, matchChildren: boolean = false) => {
		if (matchChildren) {
			return pathname === path || pathname.startsWith(`${path}/`);
		}

		return pathname === path;
	};

	return (
		<nav
			className="flex flex-col justify-between w-full h-full"
			aria-label="Sidebar"
		>
			<div
				className={clsx(
					"mt-1.5",
					sidebarCollapsed ? "flex flex-col justify-center items-center" : "",
				)}
			>
				{/* MY VIDEOS section header */}
				{!sidebarCollapsed && (
					<div className="text-[11px] font-semibold text-gray-9 uppercase tracking-wider px-2 py-1.5 mt-1">
						My Videos
					</div>
				)}

				{manageNavigation.map((item) => (
					<div
						key={item.name}
						className="flex relative justify-center items-center w-full"
					>
						{isPathActive(item.href, item.matchChildren ?? false) && (
							<motion.div
								animate={{
									width: sidebarCollapsed ? 36 : "100%",
								}}
								transition={{
									layout: {
										type: "tween",
										duration: 0.15,
									},
									width: {
										type: "tween",
										duration: 0.05,
									},
								}}
								layoutId="navlinks"
								id="navlinks"
								className="absolute inset-0 rounded-md pointer-events-none bg-[rgba(59,130,246,0.1)]"
							/>
						)}

						<NavItem
							name={item.name}
							href={item.href}
							icon={item.icon}
							sidebarCollapsed={sidebarCollapsed}
							toggleMobileNav={toggleMobileNav}
							isPathActive={isPathActive}
							extraText={item.extraText}
							matchChildren={item.matchChildren ?? false}
						/>
					</div>
				))}

				<SpacesList toggleMobileNav={() => toggleMobileNav?.()} />
			</div>

			{/* Organization Settings - admin only, at bottom */}
			{isAdmin && (
				<div
					className={clsx(
						"mt-auto pt-2",
						!sidebarCollapsed && "border-t border-gray-4",
					)}
				>
					<div className="flex relative justify-center items-center mb-1.5 w-full">
						{isPathActive("/dashboard/settings/organization") && (
							<motion.div
								animate={{
									width: sidebarCollapsed ? 36 : "100%",
								}}
								transition={{
									layout: {
										type: "tween",
										duration: 0.15,
									},
								}}
								layoutId="navlinks-settings"
								className="absolute inset-0 rounded-md pointer-events-none bg-[rgba(59,130,246,0.1)]"
							/>
						)}
						<NavItem
							name="Settings"
							href="/dashboard/settings/organization"
							icon={<CogIcon />}
							sidebarCollapsed={sidebarCollapsed}
							toggleMobileNav={toggleMobileNav}
							isPathActive={isPathActive}
							extraText={undefined}
							matchChildren={false}
						/>
					</div>
				</div>
			)}
		</nav>
	);
};

const NavItem = ({
	name,
	href,
	icon,
	sidebarCollapsed,
	toggleMobileNav,
	isPathActive,
	matchChildren,
	extraText,
}: {
	name: string;
	href: string;
	icon: React.ReactElement<{
		ref: RefObject<CogIconHandle | null>;
		className: string;
		size: number;
	}>;
	sidebarCollapsed: boolean;
	toggleMobileNav?: () => void;
	isPathActive: (path: string, matchChildren: boolean) => boolean;
	extraText: number | null | undefined;
	matchChildren: boolean;
}) => {
	const iconRef = useRef<CogIconHandle>(null);
	const active = isPathActive(href, matchChildren);
	return (
		<Tooltip disable={!sidebarCollapsed} content={name} position="right">
			<Link
				href={href}
				onClick={() => toggleMobileNav?.()}
				onMouseEnter={() => {
					iconRef.current?.startAnimation();
				}}
				onMouseLeave={() => {
					iconRef.current?.stopAnimation();
				}}
				prefetch={true}
				passHref
				className={classNames(
					"relative border border-transparent transition z-3",
					sidebarCollapsed
						? "flex justify-center items-center px-0 w-full size-9"
						: "px-2 py-[5px] w-full",
					active
						? "bg-transparent pointer-events-none text-[#3b82f6]"
						: "hover:bg-gray-2 text-gray-12",
					"flex overflow-hidden justify-start items-center tracking-tight rounded-md outline-none",
				)}
			>
				{cloneElement(icon, {
					ref: iconRef,
					className: clsx(
						active
							? "text-[#3b82f6]"
							: sidebarCollapsed
								? "text-gray-12"
								: "text-gray-10",
						sidebarCollapsed && "mx-auto",
					),
					size: sidebarCollapsed ? 18 : 16,
				})}
				<p
					className={clsx(
						"text-sm truncate",
						sidebarCollapsed ? "hidden" : "ml-1.5",
					)}
				>
					{name}
				</p>
				{extraText !== null && extraText !== undefined && !sidebarCollapsed && (
					<p className={clsx("ml-auto text-xs font-medium", active ? "text-[#3b82f6]/70" : "text-gray-11")}>
						{extraText}
					</p>
				)}
			</Link>
		</Tooltip>
	);
};

export default AdminNavItems;
