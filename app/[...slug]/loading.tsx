import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function Loading() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-950 to-black pb-20">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<div className="mb-6 space-y-3">
					<Skeleton className="h-9 w-72 rounded-xl bg-white/10" />
					<SkeletonText className="max-w-xl" lines={2} />
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/10">
							<Skeleton className="h-4 w-32 bg-white/10" />
							<Skeleton className="mt-3 h-7 w-40 bg-white/10" />
							<Skeleton className="mt-2 h-3 w-24 bg-white/10" />
						</div>
					))}
				</div>

				<div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
					<Skeleton className="h-5 w-52 bg-white/10" />
					<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
						<Skeleton className="h-10 bg-white/10" />
						<Skeleton className="h-10 bg-white/10" />
						<Skeleton className="h-10 bg-white/10" />
						<Skeleton className="h-10 bg-white/10" />
					</div>
				</div>
			</div>
		</div>
	);
}
