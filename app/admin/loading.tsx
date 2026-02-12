import { Skeleton } from "@/components/Shared";

export default function Loading() {
	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<div className="mb-6">
					<Skeleton className="h-9 w-64 rounded-xl bg-white/10" />
					<Skeleton className="mt-3 h-4 w-96 bg-white/10" />
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
							<Skeleton className="h-4 w-32 bg-white/10" />
							<Skeleton className="mt-3 h-8 w-40 bg-white/10" />
							<Skeleton className="mt-4 h-10 w-full bg-white/10" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
