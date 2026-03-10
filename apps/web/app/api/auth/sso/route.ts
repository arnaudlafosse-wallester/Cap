import crypto from "node:crypto";
import { db } from "@cap/database";
import { nanoId } from "@cap/database/helpers";
import {
	organizationMembers,
	organizations,
	users,
} from "@cap/database/schema";
import { serverEnv } from "@cap/env";
import { Organisation, User } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

export const dynamic = "force-dynamic";

/**
 * SSO endpoint for Wally integration.
 *
 * Validates an HMAC-signed request from Wally's backend,
 * finds or creates the user in Cap.so's database,
 * creates a valid NextAuth JWT session cookie,
 * and redirects to the dashboard in embed mode.
 *
 * Query params:
 *   - email: User's email address
 *   - ts: Unix timestamp (must be < 5 minutes old)
 *   - sig: HMAC-SHA256 of "{email}:{ts}" signed with CAP_SSO_SECRET
 *   - redirect: URL path to redirect to after login
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);

	const email = searchParams.get("email");
	const ts = searchParams.get("ts");
	const sig = searchParams.get("sig");
	const redirect = searchParams.get("redirect") || "/dashboard/caps";

	// Validate required params
	if (!email || !ts || !sig) {
		return NextResponse.json(
			{ error: "Missing required parameters: email, ts, sig" },
			{ status: 400 },
		);
	}

	// Check SSO secret is configured
	const ssoSecret = serverEnv().CAP_SSO_SECRET;
	if (!ssoSecret) {
		return NextResponse.json({ error: "SSO not configured" }, { status: 503 });
	}

	// Validate timestamp (max 5 minutes old)
	const timestamp = parseInt(ts, 10);
	const now = Math.floor(Date.now() / 1000);
	if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
		return NextResponse.json({ error: "SSO link expired" }, { status: 401 });
	}

	// Validate HMAC signature
	const expectedPayload = `${email}:${ts}`;
	const expectedSig = crypto
		.createHmac("sha256", ssoSecret)
		.update(expectedPayload)
		.digest("hex");

	if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	// Find or create user
	let [dbUser] = await db()
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!dbUser) {
		// Create new user with default organization
		const userId = User.UserId.make(nanoId());
		const organizationId = Organisation.OrganisationId.make(nanoId());

		await db().transaction(async (tx) => {
			await tx.insert(users).values({
				id: userId,
				email: email,
				name: email.split("@")[0],
				emailVerified: new Date(),
				activeOrganizationId: Organisation.OrganisationId.make(""),
			});

			await tx.insert(organizations).values({
				id: organizationId,
				ownerId: userId,
				name: "My Organization",
			});

			await tx.insert(organizationMembers).values({
				id: nanoId(),
				organizationId: organizationId,
				userId: userId,
				role: "owner",
			});

			await tx
				.update(users)
				.set({
					activeOrganizationId: organizationId,
					defaultOrgId: organizationId,
				})
				.where(eq(users.id, userId));
		});

		// Re-fetch the created user
		[dbUser] = await db()
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
	}

	if (!dbUser) {
		return NextResponse.json(
			{ error: "Failed to create user" },
			{ status: 500 },
		);
	}

	// Create NextAuth-compatible JWT token
	const token = await encode({
		secret: serverEnv().NEXTAUTH_SECRET,
		token: {
			id: dbUser.id,
			name: dbUser.name,
			lastName: dbUser.lastName,
			email: dbUser.email,
			picture: dbUser.image,
		},
	});

	// Build redirect response with session cookie
	// Use x-forwarded-host/proto to get the public URL (Railway runs behind a proxy)
	const forwardedHost =
		request.headers.get("x-forwarded-host") || request.headers.get("host");
	const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
	const origin = forwardedHost
		? `${forwardedProto}://${forwardedHost}`
		: request.url;
	const redirectUrl = new URL(redirect, origin);
	const response = NextResponse.redirect(redirectUrl);

	response.cookies.set("next-auth.session-token", token, {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		path: "/",
	});

	return response;
}
