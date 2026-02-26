"use client";

import { Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { SectionHeader } from "@/components/Shared";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";

export default function NotificationsSection() {
	const { supportsPush, permission, isSubscribed, busy, message, enable, disable, sendTest } = usePushNotifications();

	return (
		<section className="space-y-6">
			<SectionHeader
				title="Notifications"
				subtitle="Enable push notifications on this device."
				badge={
					<span className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-medium text-slate-200">
						Device
					</span>
				}
			/>

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
