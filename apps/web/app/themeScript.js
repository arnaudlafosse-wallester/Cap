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

	// Listen for theme changes from parent window (Wally embed)
	window.addEventListener("message", function (e) {
		if (
			e.data &&
			e.data.type === "cap-set-theme" &&
			(e.data.theme === "dark" || e.data.theme === "light")
		) {
			document.body.className = e.data.theme;
			document.cookie =
				"theme=" + e.data.theme + ";path=/;max-age=31536000";
		}
	});
}
