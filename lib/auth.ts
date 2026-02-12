import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateUserByUsername } from "@/lib/budgetPlans";

export const authOptions: NextAuthOptions = {
	session: {
		strategy: "jwt",
	},
	providers: [
		CredentialsProvider({
			name: "Username",
			credentials: {
				username: { label: "Username", type: "text" },
			},
			authorize: async (credentials) => {
				const username = String(credentials?.username ?? "")
					.trim()
					.replace(/\s+/g, "-");

				if (!username) return null;

				const user = await getOrCreateUserByUsername(username);

				return {
					id: user.id,
					name: username,
				} as any;
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
