import * as webPush from "web-push";

export type StoredWebPushSubscription = {
	endpoint: string;
	p256dh: string;
	auth: string;
};

type WebPushPayload = {
	title: string;
	body?: string;
	url?: string;
};

let isConfigured = false;

function ensureConfigured() {
	if (isConfigured) return;

	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

	if (!publicKey || !privateKey) {
		throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
	}

	webPush.setVapidDetails(subject, publicKey, privateKey);
	isConfigured = true;
}

export async function sendWebPushNotification({
	subscription,
	payload,
}: {
	subscription: StoredWebPushSubscription;
	payload: WebPushPayload;
}) {
	ensureConfigured();

	return webPush.sendNotification(
		{
			endpoint: subscription.endpoint,
			expirationTime: null,
			keys: {
				p256dh: subscription.p256dh,
				auth: subscription.auth,
			},
		},
		JSON.stringify(payload)
	);
}
