"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cap-desktop-installed";

export function useCapDesktopDetection() {
	const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
	const [isChecking, setIsChecking] = useState(false);
	const checkingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored !== null) {
			setIsInstalled(stored === "true");
		} else {
			setIsInstalled(null);
		}
	}, []);

	const openDesktop = useCallback(() => {
		if (typeof window === "undefined") return;

		setIsChecking(true);
		let handled = false;

		const onChange = () => {
			handled = true;
			document.removeEventListener("visibilitychange", onChange);
			window.removeEventListener("pagehide", onChange);
			window.removeEventListener("blur", onChange);
			localStorage.setItem(STORAGE_KEY, "true");
			setIsInstalled(true);
			setIsChecking(false);
		};

		document.addEventListener("visibilitychange", onChange, { once: true });
		window.addEventListener("pagehide", onChange, { once: true });
		window.addEventListener("blur", onChange, { once: true });

		window.location.href = "cap-desktop://";

		if (checkingRef.current) clearTimeout(checkingRef.current);
		checkingRef.current = setTimeout(() => {
			if (!handled && document.visibilityState === "visible") {
				document.removeEventListener("visibilitychange", onChange);
				window.removeEventListener("pagehide", onChange);
				window.removeEventListener("blur", onChange);
				localStorage.setItem(STORAGE_KEY, "false");
				setIsInstalled(false);
				setIsChecking(false);
				window.location.assign("/download");
			}
		}, 1500);
	}, []);

	const resetDetection = useCallback(() => {
		if (typeof window === "undefined") return;
		localStorage.removeItem(STORAGE_KEY);
		setIsInstalled(null);
	}, []);

	return {
		isInstalled,
		isChecking,
		openDesktop,
		resetDetection,
	};
}
