import Expo, { type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

export type MobilePushPayload = {
	title: string;
	body?: string;
	data?: Record<string, unknown>;
};

export type MobilePushResult = {
	sent: number;
	invalidTokens: string[];
};

/**
 * Send push notifications to one or more Expo push tokens.
 * Returns the count of successfully enqueued messages and a list of
 * tokens that are no longer valid (DeviceNotRegistered), which the
 * caller should delete from the database.
 */
export async function sendMobilePushNotifications(
	tokens: string[],
	payload: MobilePushPayload
): Promise<MobilePushResult> {
	// Filter to only valid Expo push tokens
	const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

	if (validTokens.length === 0) {
		return { sent: 0, invalidTokens: [] };
	}

	const messages: ExpoPushMessage[] = validTokens.map((to) => ({
		to,
		sound: "default",
		title: payload.title,
		body: payload.body ?? "",
		data: payload.data ?? {},
	}));

	const chunks = expo.chunkPushNotifications(messages);
	const allTickets: ExpoPushTicket[] = [];

	for (const chunk of chunks) {
		try {
			const tickets = await expo.sendPushNotificationsAsync(chunk);
			allTickets.push(...tickets);
		} catch {
			// Network or server error for this chunk — skip, don't crash
		}
	}

	// Map tickets back to tokens to identify invalid ones
	const invalidTokens: string[] = [];
	let sent = 0;

	for (let i = 0; i < allTickets.length; i++) {
		const ticket = allTickets[i];
		if (ticket.status === "ok") {
			sent += 1;
		} else if (
			ticket.status === "error" &&
			ticket.details?.error === "DeviceNotRegistered"
		) {
			invalidTokens.push(validTokens[i]);
		}
	}

	return { sent, invalidTokens };
}
