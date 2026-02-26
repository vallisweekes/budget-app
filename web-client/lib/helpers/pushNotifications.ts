export function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
}

export async function fetchVapidPublicKey(): Promise<string> {
	const res = await fetch("/api/notifications/vapid-public-key", { cache: "no-store" });
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.error ?? "Failed to load VAPID public key");
	}
	const data = (await res.json()) as { publicKey: string };
	return data.publicKey;
}
