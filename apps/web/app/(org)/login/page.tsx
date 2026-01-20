import { getCurrentUser } from "@cap/database/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
	const session = await getCurrentUser();
	if (session) {
		redirect("/dashboard");
	}
	return (
		<div className="flex relative justify-center items-center w-full h-screen bg-gray-2">
			<LoginForm />
		</div>
	);
}
