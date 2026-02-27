"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { Card } from "@/components/Shared";
import { useRouter } from "next/navigation";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";

type AuthMode = "login" | "register";

export default function LoginForm({
	initialMode = "login",
	message,
}: {
	initialMode?: AuthMode;
	message?: string;
}) {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const [error, setError] = useState<string>("");

	const normalizedUsername = useMemo(() => {
		return username.trim().replace(/\s+/g, "-");
	}, [username]);

	return (
		<Card className="mt-8">
			{message ? <div className="mb-4 text-sm text-slate-300">{message}</div> : null}
			{error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
			<div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-1">
				<button
					type="button"
					onClick={() => setMode("login")}
					className={`h-10 rounded-lg text-sm font-semibold transition ${
						mode === "login" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
					}`}
				>
					Log in
				</button>
				<button
					type="button"
					onClick={() => setMode("register")}
					className={`h-10 rounded-lg text-sm font-semibold transition ${
						mode === "register" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
					}`}
				>
					Register
				</button>
			</div>
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!normalizedUsername) return;
					setError("");
					if (mode === "register") {
						const e1 = normalizeEmail(email);
						if (!e1) {
							setError("Email is required to register.");
							return;
						}
						if (!isValidEmail(e1)) {
							setError("Please enter a valid email address.");
							return;
						}

						try {
							const res = await fetch(
								`/api/users/availability?username=${encodeURIComponent(normalizedUsername)}`,
								{ cache: "no-store" }
							);
							if (res.ok) {
								const json = (await res.json()) as { available?: boolean };
								if (json.available === false) {
									setError("User already exists. Please choose another username.");
									return;
								}
							}
						} catch {
							// If the check fails, fall back to server-side enforcement.
						}
					}
					setIsBusy(true);
					const result = await signIn("credentials", {
						redirect: false,
						username: normalizedUsername,
						email: mode === "register" ? normalizeEmail(email) : "",
						mode,
						callbackUrl: "/login",
					});
					if (!result?.ok) {
						if (mode === "register") {
							setError(
								"Registration failed. Make sure your email is valid and not already in use, and that the username isn’t already registered."
							);
						} else {
							setError("User cannot be found.");
						}
						setIsBusy(false);
						return;
					}
					router.replace(result.url ?? "/");
					setIsBusy(false);
				}}
				className="space-y-4"
			>
				<label className="block">
					<span className="block text-sm font-medium text-slate-300">Username</span>
					<input
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Enter your username"
						className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
						autoComplete="username"
					/>
				</label>

				{mode === "register" ? (
					<label className="block">
						<span className="block text-sm font-medium text-slate-300">Email</span>
						<input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Enter your email"
							required
							className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
							autoComplete="email"
						/>
					</label>
				) : null}

				<button
					type="submit"
					disabled={!normalizedUsername || isBusy}
					className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
				>
					{isBusy ? "Please wait…" : mode === "register" ? "Create account" : "Continue"}
				</button>
			</form>
		</Card>
	);
}
