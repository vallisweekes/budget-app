import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminCategoriesPage from "@/app/admin/categories/page";

export const dynamic = "force-dynamic";

export default async function AdminUserSettingsPage({
	params,
}: {
	params: Promise<{ userSegment: string }>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	
	if (!sessionUser || !sessionUsername) {
		redirect("/");
	}

	const { userSegment } = await params;
	
	// Parse user segment (format: user=username)
	if (!userSegment.startsWith("user=")) {
		redirect("/");
	}
	
	const requestedUsername = decodeURIComponent(userSegment.slice("user=".length));
	
	// For now, only allow access to own user settings
	if (requestedUsername !== sessionUsername) {
		redirect(`/admin/settings/user=${encodeURIComponent(sessionUsername)}`);
	}

	// Default to categories page for now
	return <AdminCategoriesPage />;
}
