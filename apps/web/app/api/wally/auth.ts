import { serverEnv } from "@cap/env";

export function verifyWallyApiKey(request: Request): boolean {
	const apiKey = request.headers.get("X-API-Key");
	if (!apiKey) return false;

	const expectedKey = serverEnv().CAP_WALLY_API_KEY;
	if (!expectedKey) return false;

	return apiKey === expectedKey;
}
