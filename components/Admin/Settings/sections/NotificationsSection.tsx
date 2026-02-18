"use client";

import { Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
}

async function fetchVapidPublicKey(): Promise<string> {
	const res = await fetch("/api/notifications/vapid-public-key", { cache: "no-store" });
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.error ?? "Failed to load VAPID public key");
	}
	const data = (await res.json()) as { publicKey: string };
	return data.publicKey;
}

export default function NotificationsSection() {
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

	const enable = async () => {
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
	};

	const disable = async () => {
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
	};

	const sendTest = async () => {
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
	};

	return (
		<section className="space-y-6">
			<div className="flex items-center justify-between gap-4 mb-5">
				<div>
					<h2 className="text-2xl font-bold text-white">Notifications</h2>
					<p className="text-slate-400 text-sm">Enable push notifications on this device.</p>
				</div>
				<span className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-medium text-slate-200">
					Device
				</span>
			</div>

			<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
				<div className="flex items-center gap-3 mb-6">
					<div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
						<Bell className="w-6 h-6 text-white" />
					</div>
					<div>
						<h3 className="text-xl font-bold text-white">Push Notifications</h3>
						<p className="text-slate-400 text-sm">Reminders and updates (optional).</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
						<div className="text-xs text-slate-400">Support</div>
						<div className="mt-1 text-sm text-white font-semibold flex items-center gap-2">
							{supportsPush ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
							{supportsPush ? "Supported" : "Not supported"}
						</div>
					</div>
					<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
						<div className="text-xs text-slate-400">Permission</div>
						<div className="mt-1 text-sm text-white font-semibold">{permission}</div>
					</div>
					<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
						<div className="text-xs text-slate-400">Subscription</div>
						<div className="mt-1 text-sm text-white font-semibold">{isSubscribed ? "Active" : "Not active"}</div>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row gap-3">
					<button
						type="button"
						onClick={enable}
						disabled={!supportsPush || busy || isSubscribed}
						className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
					>
						Enable
					</button>
					<button
						type="button"
						onClick={disable}
						disabled={!supportsPush || busy || !isSubscribed}
						className="flex-1 bg-slate-900/60 text-white rounded-xl py-3 font-semibold border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
					>
						Disable
					</button>
					<button
						type="button"
						onClick={sendTest}
						disabled={!supportsPush || busy || !isSubscribed}
						className="flex-1 bg-slate-900/60 text-white rounded-xl py-3 font-semibold border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
					>
						Send Test
					</button>
				</div>

				{message ? (
					<div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/40 p-4 flex items-start gap-3">
						<Info className="w-5 h-5 text-slate-300 mt-0.5" />
						<p className="text-sm text-slate-200">{message}</p>
					</div>
				) : null}

				<p className="mt-5 text-xs text-slate-400">
					Push notifications require HTTPS and an installed service worker. This app’s PWA service worker is disabled in
					 development builds.
				</p>
			</div>
		</section>
	);
}
