"use client";

export default function DebtsEmptyState() {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/10">
			<div className="text-6xl mb-4">🎉</div>
			<h3 className="text-xl font-semibold text-white mb-2">No Debts!</h3>
			<p className="text-slate-400">You have no tracked debts at the moment.</p>
		</div>
	);
}
