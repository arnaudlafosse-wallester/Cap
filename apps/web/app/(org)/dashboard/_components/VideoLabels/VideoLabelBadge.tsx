"use client";

import clsx from "clsx";

interface VideoLabelBadgeProps {
	name: string;
	displayName: string;
	color: string;
	size?: "sm" | "md";
	onClick?: () => void;
	onRemove?: () => void;
	isAiSuggested?: boolean;
	confidence?: number;
}

export function VideoLabelBadge({
	name,
	displayName,
	color,
	size = "sm",
	onClick,
	onRemove,
	isAiSuggested,
	confidence,
}: VideoLabelBadgeProps) {
	// Convert hex color to RGB for background with transparency
	const hexToRgb = (hex: string) => {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (result && result[1] && result[2] && result[3]) {
			return {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			};
		}
		return { r: 107, g: 114, b: 128 }; // fallback gray
	};

	const rgb = hexToRgb(color);
	const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
	const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;

	return (
		<span
			className={clsx(
				"inline-flex items-center gap-1 rounded-full border font-medium transition-colors",
				size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
				onClick && "cursor-pointer hover:opacity-80",
			)}
			style={{
				backgroundColor: bgColor,
				borderColor: borderColor,
				color: color,
			}}
			onClick={onClick}
		>
			{isAiSuggested && (
				<span
					title={`AI suggested (${Math.round((confidence || 0) * 100)}% confidence)`}
				>
					✨
				</span>
			)}
			{displayName}
			{onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="ml-0.5 hover:opacity-70"
				>
					×
				</button>
			)}
		</span>
	);
}
