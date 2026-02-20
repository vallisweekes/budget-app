import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
			<div className="w-full max-w-2xl">
				<div className="flex flex-col items-center text-center gap-4 sm:gap-5">
					<div className="w-full max-w-md">
						<Image
							src="/404 error lost in space-rafiki.png"
							alt="404 not found"
							width={900}
							height={700}
							priority
							className="w-full h-auto"
						/>
					</div>

					<div className="space-y-2">
						<div className="text-xs sm:text-sm text-slate-400">404</div>
						<h1 className="text-xl sm:text-2xl font-bold text-white">Page not found</h1>
						<p className="text-sm sm:text-base text-slate-300">
							That link doesn’t exist anymore (or never did).
						</p>
					</div>

					<div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
						<Link
							href="/dashboard"
							className="px-4 py-2.5 rounded-lg bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white font-medium transition-colors text-sm"
						>
							Go to Dashboard
						</Link>
						<Link
							href="/admin/debts"
							className="px-4 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 text-slate-200 font-medium transition-colors text-sm"
						>
							Go to Debts
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
