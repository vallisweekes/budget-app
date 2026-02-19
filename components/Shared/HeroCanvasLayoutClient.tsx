"use client";

import type { ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>): string {
	return classes.filter(Boolean).join(" ");
}

export default function HeroCanvasLayoutClient(props: {
	hero: ReactNode;
	children: ReactNode;
	maxWidthClassName?: string;
	bodyPaddingTopClassName?: string;
	className?: string;
	darkCards?: boolean;
}) {
	const {
		hero,
		children,
		maxWidthClassName = "max-w-6xl",
		bodyPaddingTopClassName = "pt-6 sm:pt-8 lg:pt-10",
		className,
		darkCards = true,
	} = props;

	return (
		<div
			className={cx(
				"dashboard-canvas-bg min-h-screen pb-20",
				darkCards && "dashboard-dark-cards",
				className
			)}
		>
			<section className="dashboard-hero">
				<div className={cx("mx-auto w-full px-4 py-6", maxWidthClassName)}>{hero}</div>
			</section>

			<div className="relative">
				<div aria-hidden className="dashboard-left-underlay" />
				<div className={cx("dashboard-canvas-content relative z-10", bodyPaddingTopClassName)}>
					<div className={cx("mx-auto w-full px-4", maxWidthClassName)}>{children}</div>
				</div>
			</div>
		</div>
	);
}
