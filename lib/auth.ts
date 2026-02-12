import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateBudgetPlanForUser, getOrCreateUserByUsername, isSupportedBudgetType } from "@/lib/budgetPlans";

export const authOptions: NextAuthOptions = {
	session: {
		strategy: "jwt",
	},
	providers: [
		CredentialsProvider({
			name: "Username",
			credentials: {
				username: { label: "Username", type: "text" },
				budgetType: { label: "Budget Type", type: "text" },
			},
			authorize: async (credentials) => {
				const username = String(credentials?.username ?? "")
					.trim()
					.replace(/\s+/g, "-");
				const budgetTypeRaw = String(credentials?.budgetType ?? "personal").trim();
				const budgetType = isSupportedBudgetType(budgetTypeRaw) ? budgetTypeRaw : "personal";

				if (!username) return null;

				const user = await getOrCreateUserByUsername(username);
				const budgetPlan = await getOrCreateBudgetPlanForUser({ userId: user.id, budgetType });

				return {
					id: user.id,
					name: username,
					budgetType,
					budgetPlanId: budgetPlan.id,
				} as any;
			},
		}),
	],
	callbacks: {
		jwt: async ({ token, user }) => {
			if (user) {
				token.username = (user as any).name;
				token.budgetType = (user as any).budgetType ?? "personal";
				token.budgetPlanId = (user as any).budgetPlanId;
			}
			return token;
		},
		session: async ({ session, token }) => {
			if (session.user) {
				(session.user as any).username = token.username as string | undefined;
				(session.user as any).budgetType = token.budgetType as string | undefined;
				(session.user as any).budgetPlanId = token.budgetPlanId as string | undefined;
			}
			return session;
		},
	},
};
