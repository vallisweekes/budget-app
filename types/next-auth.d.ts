import "next-auth";

declare module "next-auth" {
	interface Session {
		user?: {
			id?: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
			username?: string;
			budgetType?: string;
			budgetPlanId?: string;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		userId?: string;
		username?: string;
		budgetType?: string;
		budgetPlanId?: string;
	}
}
