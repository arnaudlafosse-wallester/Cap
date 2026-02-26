export function script() {
	const cookie = (() => {
		if (!document.cookie) return undefined;
		const match = document.cookie.match(/\W?theme=(?<theme>\w+)/);
		return match?.groups?.theme;
	})();

	const pathname = window.location.pathname;
	const isDashboardPath =
		pathname.startsWith("/dashboard") ||
		pathname.startsWith("/login") ||
		pathname.startsWith("/onboarding");

	if (isDashboardPath) document.body.classList.add(cookie ?? "light");

	// Wally embed mode detection
	const embedMatch = document.cookie.match(/(?:^|;\s*)cap-embed=([^;]*)/);
	if (embedMatch && embedMatch[1] === "true") {
		document.documentElement.classList.add("wally-embed");
	}
}
