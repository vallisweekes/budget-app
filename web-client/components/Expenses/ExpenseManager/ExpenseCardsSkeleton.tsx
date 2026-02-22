import { Skeleton, SkeletonText } from "@/components/Shared";

export default function ExpenseCardsSkeleton({ count = 4 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 gap-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10"
				>
					<div className="p-6 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40">
						<div className="flex items-center justify-between gap-6">
							<div className="flex items-center gap-4">
								<Skeleton className="h-14 w-14 rounded-2xl" />
								<div className="min-w-[180px]">
									<Skeleton className="h-6 w-40" />
									<Skeleton className="mt-2 h-4 w-24" />
								</div>
							</div>
							<div className="text-right">
								<Skeleton className="h-7 w-28 ml-auto" />
								<Skeleton className="mt-2 h-4 w-20 ml-auto" />
							</div>
						</div>
					</div>

					<div className="p-5">
						<SkeletonText lines={3} />
					</div>
				</div>
			))}
		</div>
	);
}
