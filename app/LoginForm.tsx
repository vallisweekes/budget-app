"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import Card from "@/components/Card";

export default function LoginForm() {
	const [username, setUsername] = useState("");
	const [isBusy, setIsBusy] = useState(false);

	const normalizedUsername = useMemo(() => {
		return username.trim().replace(/\s+/g, "-");
	}, [username]);

	return (
		<Card className="mt-8">
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!normalizedUsername) return;
					setIsBusy(true);
					await signIn("credentials", {
						redirect: true,
						username: normalizedUsername,
						callbackUrl: "/dashboard",
					});
					setIsBusy(false);
				}}
				className="space-y-4"
			>
				<label className="block">
					<span className="block text-sm font-medium text-slate-300">User name</span>
					<input
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="e.g. vallis"
						className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
						autoComplete="username"
					/>
				</label>

				<button
					type="submit"
					disabled={!normalizedUsername || isBusy}
					className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
				>
					{isBusy ? "Signing in…" : "Continue"}
				</button>

				<div className="text-xs text-slate-400">Creates your user in the DB (if missing).</div>
			</form>
		</Card>
	);
}
