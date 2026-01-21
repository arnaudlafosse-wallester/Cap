"use client";

import clsx from "clsx";
import { differenceInDays, differenceInHours } from "date-fns";
import { Clock } from "lucide-react";

interface RetentionBadgeProps {
	expiresAt: Date | null;
	keepPermanently?: boolean;
	size?: "sm" | "md";
	showIcon?: boolean;
}

export function RetentionBadge({
	expiresAt,
	keepPermanently = false,
	size = "sm",
	showIcon = true,
}: RetentionBadgeProps) {
	// Don't show badge if no expiration or kept permanently
	if (!expiresAt || keepPermanently) return null;

	const now = new Date();
	const daysLeft = differenceInDays(expiresAt, now);
	const hoursLeft = differenceInHours(expiresAt, now);

	// Determine urgency level and styling
	let urgencyClass: string;
	let displayText: string;

	if (daysLeft < 0 || hoursLeft < 0) {
		// Already expired
		urgencyClass =
			"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
		displayText = "Expired";
	} else if (hoursLeft < 24) {
		// Less than 24 hours
		urgencyClass =
			"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
		displayText = hoursLeft <= 1 ? "< 1h" : `${hoursLeft}h`;
	} else if (daysLeft <= 3) {
		// 1-3 days - critical
		urgencyClass =
			"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
		displayText = `${daysLeft}j`;
	} else if (daysLeft <= 7) {
		// 4-7 days - warning
		urgencyClass =
			"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800";
		displayText = `${daysLeft}j`;
	} else {
		// More than 7 days - info
		urgencyClass =
			"bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
		displayText = `${daysLeft}j`;
	}

	return (
		<span
			className={clsx(
				"inline-flex items-center gap-1 rounded-full border font-medium",
				size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
				urgencyClass,
			)}
			title={`This video will be automatically deleted on ${expiresAt.toLocaleDateString()}`}
		>
			{showIcon && <Clock className={size === "sm" ? "size-3" : "size-3.5"} />}
			{displayText}
		</span>
	);
}
