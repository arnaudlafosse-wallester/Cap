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
		{
			name: "Organization Settings",
			href: `/dashboard/settings/organization`,
			adminOnly: true,
			icon: <CogIcon />,
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
				{manageNavigation
					.filter((item) => !item.adminOnly || isAdmin)
					.map((item) => (
						<div
							key={item.name}
							className="flex relative justify-center items-center mb-1.5 w-full"
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
									className="absolute h-[36px] w-full rounded-xl pointer-events-none bg-gray-3"
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
			{/* Footer removed for self-hosted version */}
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
						: "px-3 py-2 w-full",
					isPathActive(href, matchChildren)
						? "bg-transparent pointer-events-none"
						: "hover:bg-gray-2",
					"flex overflow-hidden justify-start items-center tracking-tight rounded-xl outline-none",
				)}
			>
				{cloneElement(icon, {
					ref: iconRef,
					className: clsx(
						sidebarCollapsed ? "text-gray-12 mx-auto" : "text-gray-10",
					),
					size: sidebarCollapsed ? 18 : 16,
				})}
				<p
					className={clsx(
						"text-sm text-gray-12 truncate",
						sidebarCollapsed ? "hidden" : "ml-2.5",
					)}
				>
					{name}
				</p>
				{extraText !== null && !sidebarCollapsed && (
					<p className="ml-auto text-xs font-medium text-gray-11">
						{extraText}
					</p>
				)}
			</Link>
		</Tooltip>
	);
};

export default AdminNavItems;
