import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByUsername, registerUserByUsername } from "@/lib/budgetPlans";
import { normalizeUsername } from "@/lib/helpers/username";
import { consumeEmailLoginCode, isEmailLoginCodeRequired } from "@/lib/auth/loginCodes";

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
				code: { label: "Code", type: "text" },
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

				if (mode === "login" && isEmailLoginCodeRequired()) {
					const code = String((credentials as any)?.code ?? "").trim();
					if (!code) return null;
					const ok = await consumeEmailLoginCode({ userId: user.id, code });
					if (!ok) return null;
				}

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

			const normalizedUsername = normalizeUsername(String((token as any).username ?? ""));
			if (normalizedUsername) {
				token.username = normalizedUsername;
			}

			const sid = String((token as any).sid ?? "").trim();
			if (sid) {
				(token as any).sid = sid;
			}
			return token;
		},
		session: async ({ session, token }) => {
			if (session.user) {
				(session.user as any).id = (token.userId as string | undefined) ?? (token.sub as string | undefined);
				(session.user as any).username = token.username as string | undefined;
				(session.user as any).sessionId = (token as any).sid as string | undefined;
			}
			return session;
		},
	},
};
