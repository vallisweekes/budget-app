function cx(...parts: Array<string | undefined | null | false>) {
	return parts.filter(Boolean).join(" ");
}

export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			aria-hidden
			className={cx(
				"animate-pulse rounded-lg bg-slate-900/10",
				"[background-image:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]",
				"bg-[length:200%_100%] bg-left motion-safe:animate-[shimmer_1.4s_infinite]",
				className
			)}
		/>
	);
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
	return (
		<div className={cx("space-y-2", className)}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton key={i} className={cx("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
			))}
		</div>
	);
}
