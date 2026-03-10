import { getCurrentUser } from "@cap/database/auth/session";
import { buildEnv } from "@cap/env";
import { redirect } from "next/navigation";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
	const session = await getCurrentUser();
	if (session) {
		redirect("/dashboard");
	}

	const isSelfHosted = buildEnv.NEXT_PUBLIC_IS_CAP !== "true";
	return <LoginForm isSelfHosted={isSelfHosted} />;
}
