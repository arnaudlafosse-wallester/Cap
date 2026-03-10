"use client";

import { useEffect } from "react";

export function EmbedSessionExpired() {
	useEffect(() => {
		window.parent.postMessage({ type: "cap-session-expired" }, "*");
	}, []);

	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-gray-2">
			<div className="text-center p-8">
				<p className="text-gray-10 text-sm">Session expired. Reconnecting...</p>
			</div>
		</div>
	);
}
