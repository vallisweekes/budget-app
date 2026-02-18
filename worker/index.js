/* global self */

const DEFAULT_TITLE = "Budget App";

self.addEventListener("push", (event) => {
	const show = async () => {
		let data = null;
		try {
			data = event?.data?.json?.();
		} catch {
			try {
				data = { body: event?.data?.text?.() };
			} catch {
				data = null;
			}
		}

		const title = data?.title ?? DEFAULT_TITLE;
		const body = data?.body ?? "";
		const url = data?.url ?? "/dashboard";

		await self.registration.showNotification(title, {
			body,
			icon: "/icon-192x192.png",
			badge: "/icon-192x192.png",
			data: { url },
		});
	};

	event.waitUntil(show());
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event?.notification?.data?.url ?? "/dashboard";

	const open = async () => {
		const allClients = await self.clients.matchAll({
			type: "window",
			includeUncontrolled: true,
		});

		for (const client of allClients) {
			if ("focus" in client) {
				await client.focus();
				if ("navigate" in client) {
					try {
						await client.navigate(url);
					} catch {
						// ignore
					}
				}
				return;
			}
		}

		if (self.clients.openWindow) {
			await self.clients.openWindow(url);
		}
	};

	event.waitUntil(open());
});
