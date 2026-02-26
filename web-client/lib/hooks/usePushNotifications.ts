import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchVapidPublicKey, urlBase64ToUint8Array } from "@/lib/helpers/pushNotifications";

export function usePushNotifications() {
	const supportsPush = useMemo(() => {
		if (typeof window === "undefined") return false;
		return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
	}, []);

	const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
	const [isSubscribed, setIsSubscribed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setMessage(null);
		if (!supportsPush) {
			setPermission("unsupported");
			setIsSubscribed(false);
			return;
		}

		setPermission(Notification.permission);
		const reg = await navigator.serviceWorker.getRegistration();
		const sub = await reg?.pushManager.getSubscription();
		setIsSubscribed(Boolean(sub));
	}, [supportsPush]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const enable = useCallback(async () => {
		setBusy(true);
		setMessage(null);
		try {
			if (!supportsPush) throw new Error("Push notifications are not supported in this browser.");

			const nextPermission = await Notification.requestPermission();
			setPermission(nextPermission);
			if (nextPermission !== "granted") {
				throw new Error("Notification permission not granted.");
			}

			const reg = await navigator.serviceWorker.register("/sw.js");
			await navigator.serviceWorker.ready;

			const publicKey = await fetchVapidPublicKey();
			const subscription = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});

			const res = await fetch("/api/notifications/subscribe", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					subscription: subscription.toJSON(),
					userAgent: navigator.userAgent,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error ?? "Failed to save subscription");
			}

			setIsSubscribed(true);
			setMessage("Notifications enabled on this device.");
		} catch (err: any) {
			setMessage(String(err?.message ?? err));
		} finally {
			setBusy(false);
			await refresh();
		}
	}, [refresh, supportsPush]);

	const disable = useCallback(async () => {
		setBusy(true);
		setMessage(null);
		try {
			if (!supportsPush) return;
			const reg = await navigator.serviceWorker.getRegistration();
			const sub = await reg?.pushManager.getSubscription();
			if (sub) {
				await fetch("/api/notifications/unsubscribe", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ endpoint: sub.endpoint }),
				});
				await sub.unsubscribe();
			}
			setIsSubscribed(false);
			setMessage("Notifications disabled on this device.");
		} catch (err: any) {
			setMessage(String(err?.message ?? err));
		} finally {
			setBusy(false);
			await refresh();
		}
	}, [refresh, supportsPush]);

	const sendTest = useCallback(async () => {
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch("/api/notifications/test", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Budget App",
					body: "This is a test notification.",
					url: "/dashboard",
				}),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error ?? "Failed to send test notification");
			setMessage(`Sent: ${data?.sent ?? 0}, removed stale: ${data?.removed ?? 0}`);
		} catch (err: any) {
			setMessage(String(err?.message ?? err));
		} finally {
			setBusy(false);
			await refresh();
		}
	}, [refresh]);

	return {
		supportsPush,
		permission,
		isSubscribed,
		busy,
		message,
		enable,
		disable,
		sendTest,
	};
}
