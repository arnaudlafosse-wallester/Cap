import { getCurrentUser } from "@cap/database/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmbedSessionExpired } from "./embed-session-expired";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
	const session = await getCurrentUser();
	if (session) {
		redirect("/dashboard");
	}

	const isEmbed = (await cookies()).get("cap-embed")?.value === "true";
	if (isEmbed) {
		return <EmbedSessionExpired />;
	}

	return <LoginForm />;
}
