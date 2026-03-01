import { prisma } from "@/lib/prisma";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";
import { getUserNotificationPreferences } from "@/lib/push/userNotificationPreferences";
import { sendWebPushNotification, type StoredWebPushSubscription } from "@/lib/push/webPush";

export type UserPushPreference = "dueReminders" | "paymentAlerts";

export async function sendUserPush(params: {
	userId: string;
	preference: UserPushPreference;
	web: { title: string; body?: string; url?: string };
	mobile: { title: string; body?: string; data?: Record<string, unknown> };
}): Promise<{ sentWeb: number; sentMobile: number }> {
	function getOptionalStatusCode(error: unknown): number | null {
		if (!error || typeof error !== "object") return null;
		if (!("statusCode" in error)) return null;
		const value = (error as { statusCode?: unknown }).statusCode;
		return typeof value === "number" ? value : null;
	}

	const userId = params.userId.trim();
	if (!userId) return { sentWeb: 0, sentMobile: 0 };

	const prefs = await getUserNotificationPreferences(userId);
	if (params.preference === "dueReminders" && !prefs.dueReminders) {
		return { sentWeb: 0, sentMobile: 0 };
	}
	if (params.preference === "paymentAlerts" && !prefs.paymentAlerts) {
		return { sentWeb: 0, sentMobile: 0 };
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			webPushSubscriptions: {
				select: { endpoint: true, p256dh: true, auth: true },
			},
			mobilePushTokens: {
				select: { token: true },
			},
		},
	});
	if (!user) return { sentWeb: 0, sentMobile: 0 };

	let sentWeb = 0;
	const invalidEndpoints: string[] = [];

	for (const sub of user.webPushSubscriptions) {
		try {
			await sendWebPushNotification({
				subscription: sub as StoredWebPushSubscription,
				payload: params.web,
			});
			sentWeb += 1;
		} catch (error) {
			const statusCode = getOptionalStatusCode(error);
			if (statusCode === 404 || statusCode === 410) {
				invalidEndpoints.push(sub.endpoint);
			}
		}
	}

	if (invalidEndpoints.length > 0) {
		const webPushSubscription = (prisma as unknown as { webPushSubscription?: { deleteMany: (args: { where: { endpoint: { in: string[] } } }) => Promise<unknown> } })
			.webPushSubscription;
		if (webPushSubscription) {
			await webPushSubscription.deleteMany({
				where: { endpoint: { in: Array.from(new Set(invalidEndpoints)) } },
			});
		}
	}

	const tokens = user.mobilePushTokens.map((t) => t.token).filter(Boolean);
	let sentMobile = 0;
	if (tokens.length > 0) {
		const result = await sendMobilePushNotifications(tokens, {
			title: params.mobile.title,
			body: params.mobile.body,
			data: params.mobile.data,
		});
		sentMobile = result.sent;

		if (result.invalidTokens.length > 0) {
			const mobilePushToken = (prisma as unknown as { mobilePushToken?: { deleteMany: (args: { where: { token: { in: string[] } } }) => Promise<unknown> } })
				.mobilePushToken;
			if (mobilePushToken) {
				await mobilePushToken.deleteMany({
					where: { token: { in: result.invalidTokens } },
				});
			}
		}
	}

	return { sentWeb, sentMobile };
}
