import type { UpcomingPayment } from "@/lib/expenses/insights";

const dueMonthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	timeZone: "UTC",
});

function ordinalSuffix(day: number): string {
	const d = Math.trunc(day);
	const mod100 = d % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	switch (d % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

export function formatIsoDueDateOrdinal(iso: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
	const [year, month, day] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return iso;
	const dt = new Date(Date.UTC(year, month - 1, day));
	const monthLabel = dueMonthFormatter.format(dt);
	const dayNum = dt.getUTCDate();
	return `${monthLabel} ${dayNum}${ordinalSuffix(dayNum)}`;
}

export function badgeClass(kind: "ok" | "warn" | "bad" | "muted"): string {
	switch (kind) {
		case "ok":
			return "bg-emerald-500/20 text-emerald-200 border-emerald-400/20";
		case "warn":
			return "bg-amber-500/20 text-amber-200 border-amber-400/20";
		case "bad":
			return "bg-red-500/20 text-red-200 border-red-400/20";
		default:
			return "bg-white/10 text-slate-200 border-white/10";
	}
}

export function dotClass(kind: "ok" | "warn" | "bad" | "muted"): string {
	switch (kind) {
		case "ok":
			return "bg-emerald-400";
		case "warn":
			return "bg-amber-400";
		case "bad":
			return "bg-red-400";
		default:
			return "bg-slate-400";
	}
}

function titleCaseIfAllCaps(value: string): string {
	const s = String(value ?? "").trim();
	if (!s) return s;
	if (!/[A-Za-z]/.test(s)) return s;
	if (s !== s.toUpperCase()) return s;
	return s
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

export function normalizeUpcomingName(rawName: string): string {
	let s = String(rawName ?? "").trim();
	if (!s) return s;

	// Remove trailing auto-appended date tokens like "(2026-01)", "(2026-01 2026)", or "(2026-01 2026-01)".
	s = s.replace(/\s*\((\d{4}-\d{2})(?:\s+\d{4}(?:-\d{2})?)?\)\s*$/u, "").trim();

	// Remove any legacy debt suffix if present.
	s = s.replace(/\s*\(Debt\)\s*$/i, "").trim();

	// If there's a category prefix (e.g. "Housing: RENT"), title-case ALL CAPS parts on each side.
	if (s.includes(":")) {
		const idx = s.indexOf(":");
		const left = s.slice(0, idx).trim();
		const right = s.slice(idx + 1).trim();
		const leftNice = titleCaseIfAllCaps(left);
		const rightNice = titleCaseIfAllCaps(right);
		return rightNice ? `${leftNice}: ${rightNice}` : leftNice;
	}

	return titleCaseIfAllCaps(s);
}

export function urgencyTone(urgency: UpcomingPayment["urgency"]): "ok" | "warn" | "bad" {
	if (urgency === "overdue" || urgency === "today") return "bad";
	if (urgency === "soon") return "warn";
	return "ok";
}

export function dueLabel(u: UpcomingPayment): string {
	if (u.urgency === "today") return "Due Today";
	if (u.urgency === "overdue") return "Past Due Date";
	return `Due on ${formatIsoDueDateOrdinal(u.dueDate)}`;
}

export function toTitleCaseMonthOnly(label: string): string {
	const trimmed = String(label ?? "").trim();
	if (!trimmed) return "";
	const parts = trimmed.split(/\s+/);
	if (parts.length < 1) return trimmed;
	const month = parts[0];
	const monthTc = month.length ? month[0].toUpperCase() + month.slice(1).toLowerCase() : month;
	return monthTc;
}
