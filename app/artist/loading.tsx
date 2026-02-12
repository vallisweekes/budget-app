import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function Loading() {
	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-4xl px-4 py-10">
				<div className="rounded-2xl border border-white/10 bg-slate-800/40 p-6">
					<Skeleton className="h-8 w-40 bg-white/10" />
					<SkeletonText className="mt-4 max-w-xl" lines={3} />
				</div>
			</div>
		</div>
	);
}
