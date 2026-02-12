import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function Loading() {
	return (
		<div className="min-h-screen bg-[#0a0d14]">
			<div className="mx-auto w-full max-w-6xl px-4 py-10">
				<div className="space-y-6">
					<div className="space-y-3">
						<Skeleton className="h-9 w-48 rounded-xl bg-white/10" />
						<SkeletonText className="max-w-xl" lines={2} />
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="rounded-2xl border border-white/10 bg-slate-800/40 p-4">
								<Skeleton className="h-4 w-32 bg-white/10" />
								<Skeleton className="mt-3 h-7 w-40 bg-white/10" />
								<Skeleton className="mt-2 h-3 w-24 bg-white/10" />
							</div>
						))}
					</div>

					<div className="rounded-2xl border border-white/10 bg-slate-800/40 p-6">
						<Skeleton className="h-5 w-44 bg-white/10" />
						<div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
							<Skeleton className="h-10 bg-white/10" />
							<Skeleton className="h-10 bg-white/10" />
							<Skeleton className="h-10 bg-white/10" />
							<Skeleton className="h-10 bg-white/10" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
