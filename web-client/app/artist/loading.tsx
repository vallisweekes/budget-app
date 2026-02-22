import { Skeleton, SkeletonText } from "@/components/Shared";

export default function Loading() {
	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-4xl px-4 py-10">
				<div className="rounded-2xl border border-white/10 bg-slate-800/40 p-6">
					<Skeleton className="h-8 w-40 bg-white/10" />
					<SkeletonText className="mt-4 max-w-xl" lines={3} />
				</div>
			</div>
		</div>
	);
}
