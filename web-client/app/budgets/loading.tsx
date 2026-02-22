import { Skeleton, SkeletonText } from "@/components/Shared";

export default function Loading() {
	return (
		<div className="min-h-screen bg-[#0a0d14]">
			<div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16">
				<div className="w-full space-y-6">
					<div className="space-y-3">
						<Skeleton className="h-7 w-28 rounded-full bg-white/10" />
						<Skeleton className="h-10 w-80 rounded-xl bg-white/10" />
						<SkeletonText className="max-w-xl" lines={2} />
					</div>

					<div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
						<Skeleton className="h-10 w-full bg-white/10" />
						<Skeleton className="h-10 w-full bg-white/10" />
						<Skeleton className="h-10 w-40 bg-white/10" />
					</div>
				</div>
			</div>
		</div>
	);
}
