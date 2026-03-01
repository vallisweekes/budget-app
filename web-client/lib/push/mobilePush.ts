import Expo, { type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

export type MobilePushPayload = {
	title: string;
	body?: string;
	data?: Record<string, unknown>;
	/** iOS app icon badge number (absolute). */
	badge?: number;
	/** Send as a data-only push suitable for background task handling. */
	silent?: boolean;
};

export type MobilePushResult = {
	sent: number;
	invalidTokens: string[];
	errors: string[];
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
		return { sent: 0, invalidTokens: [], errors: [] };
	}

	const isSilent = payload.silent === true;
	const messages: ExpoPushMessage[] = validTokens.map((to) => ({
		to,
		// Android 8+: route notifications through a known channel.
		channelId: "default",
		...(isSilent
			? {
				// iOS headless/background delivery requires data-only + _contentAvailable.
				_contentAvailable: true,
				data: payload.data ?? {},
				priority: "high",
			}
			: {
				sound: "default",
				title: payload.title,
				body: payload.body ?? "",
				data: payload.data ?? {},
				...(typeof payload.badge === "number" && Number.isFinite(payload.badge)
					? { badge: Math.max(0, Math.floor(payload.badge)) }
					: null),
			}),
	}));

	const chunks = expo.chunkPushNotifications(messages);
	const allTickets: Array<{ token: string; ticket: ExpoPushTicket }> = [];
	const errors: string[] = [];
	let nextTokenIndex = 0;

	for (const chunk of chunks) {
		const chunkTokens = validTokens.slice(nextTokenIndex, nextTokenIndex + chunk.length);
		nextTokenIndex += chunk.length;

		try {
			const tickets = await expo.sendPushNotificationsAsync(chunk);
			for (let i = 0; i < tickets.length; i++) {
				const ticket = tickets[i];
				const token = chunkTokens[i] ?? "";
				allTickets.push({ token, ticket });
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`chunk send failed: ${message}`);
		}
	}

	// Map tickets back to tokens to identify invalid ones
	const invalidTokens: string[] = [];
	let sent = 0;

	for (const entry of allTickets) {
		const { ticket, token } = entry;
		if (ticket.status === "ok") {
			sent += 1;
		} else if (
			ticket.status === "error" &&
			ticket.details?.error === "DeviceNotRegistered"
		) {
			if (token) invalidTokens.push(token);
		} else if (ticket.status === "error") {
			const detail = ticket.details?.error ? ` (${ticket.details.error})` : "";
			const msg = ticket.message ? `: ${ticket.message}` : "";
			errors.push(`ticket error${detail}${msg}`);
		}
	}

	return {
		sent,
		invalidTokens: Array.from(new Set(invalidTokens)),
		errors: Array.from(new Set(errors)),
	};
}
