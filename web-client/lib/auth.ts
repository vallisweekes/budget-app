import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateUserByUsername, getUserByUsername, registerUserByUsername } from "@/lib/budgetPlans";
import { normalizeUsername } from "@/lib/helpers/username";

export const authOptions: NextAuthOptions = {
	secret: process.env.NEXTAUTH_SECRET,
	session: {
		strategy: "jwt",
	},
	providers: [
		CredentialsProvider({
			name: "Username",
			credentials: {
				username: { label: "Username", type: "text" },
				email: { label: "Email", type: "email" },
				mode: { label: "Mode", type: "text" },
			},
			authorize: async (credentials) => {
				const username = normalizeUsername(String(credentials?.username ?? ""));

				if (!username) return null;
				const mode = String(credentials?.mode ?? "login").trim().toLowerCase();
				const email = String(credentials?.email ?? "")
					.trim()
					.toLowerCase();

				const user =
					mode === "register"
						? await registerUserByUsername({ username, email })
						: await getUserByUsername(username);

				if (!user) return null;

				return {
					id: user.id,
					name: username,
				};
			},
		}),
	],
	callbacks: {
		jwt: async ({ token, user }) => {
			if (user) {
				token.userId = (user as any).id ?? token.sub;
				token.username = (user as any).name;
			}
			if (!token.userId) token.userId = token.sub;

			// Keep PWA + desktop sessions consistent. If the DB was reset or the JWT is
			// stale, reconcile the token's userId to the DB user for token.username.
			const normalizedUsername = normalizeUsername(String((token as any).username ?? ""));
			if (normalizedUsername) {
				const byUsername = await getOrCreateUserByUsername(normalizedUsername);
				token.userId = byUsername.id;
				token.username = normalizedUsername;
			}
			return token;
		},
		session: async ({ session, token }) => {
			if (session.user) {
				(session.user as any).id = (token.userId as string | undefined) ?? (token.sub as string | undefined);
				(session.user as any).username = token.username as string | undefined;
			}
			return session;
		},
	},
};
