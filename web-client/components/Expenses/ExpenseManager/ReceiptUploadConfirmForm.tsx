import type { MonthKey } from "@/types";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";
import { SelectDropdown } from "@/components/Shared";
import { monthName } from "@/lib/helpers/monthName";

type ScanResult = {
	receiptId: string;
	merchant: string | null;
	amount: number | null;
	currency: string | null;
	date: string | null;
	suggestedCategory: string | null;
};

export default function ReceiptUploadConfirmForm(props: {
	scanResult: ScanResult;
	preview: string | null;
	month: MonthKey;
	year: number;
	categories: ExpenseCategoryOption[];
	name: string;
	amount: string;
	date: string;
	categoryId: string;
	confirming: boolean;
	onChangeName: (value: string) => void;
	onChangeAmount: (value: string) => void;
	onChangeDate: (value: string) => void;
	onChangeCategoryId: (value: string) => void;
	onReset: () => void;
	onConfirm: () => void;
}) {
	const { scanResult, preview, month, year, categories, name, amount, date, categoryId, confirming, onChangeName, onChangeAmount, onChangeDate, onChangeCategoryId, onReset, onConfirm } =
		props;

	return (
		<div className="space-y-5">
			<div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
				<svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
				</svg>
				<p className="text-sm text-emerald-200">Receipt scanned — review and confirm the details below.</p>
			</div>

			{preview ? (
				<div className="flex items-center gap-4">
					<img src={preview} alt="Receipt" className="h-16 w-16 rounded-xl object-cover shadow" />
					<button
						type="button"
						onClick={onReset}
						className="text-xs text-slate-400 underline underline-offset-2 hover:text-white transition-colors"
					>
						Use a different receipt
					</button>
				</div>
			) : null}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Merchant / Name</span>
					<input
						value={name}
						onChange={(e) => onChangeName(e.target.value)}
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="e.g., Tesco"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Amount (£)</span>
					<input
						type="number"
						step="0.01"
						value={amount}
						onChange={(e) => onChangeAmount(e.target.value)}
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="0.00"
					/>
				</label>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Date</span>
					<input
						type="date"
						value={date}
						onChange={(e) => onChangeDate(e.target.value)}
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all [color-scheme:dark]"
					/>
					{date
						? (() => {
								const d = new Date(date);
								if (!isNaN(d.getTime())) {
									const m = d.getMonth() + 1;
									const y = d.getFullYear();
									const original = typeof month === "number" ? month : parseInt(String(month), 10);
									if (m !== original || y !== year) {
										return (
											<p className="mt-1.5 text-xs text-amber-300">
												Will be logged to {monthName(m)} {y}
											</p>
										);
									}
								}
								return null;
						  })()
						: null}
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
					<SelectDropdown
						value={categoryId}
						onValueChange={onChangeCategoryId}
						placeholder="Select Category"
						options={[
							...categories.map((c) => ({ value: c.id, label: c.name })),
							{ value: "", label: "Miscellaneous" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>
			</div>

			<div className="flex gap-3 pt-1">
				<button
					type="button"
					onClick={onReset}
					className="flex-1 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50 transition-all"
				>
					Discard
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={confirming || !scanResult || !name.trim() || !amount}
					className="flex-[2] bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
				>
					{confirming ? "Saving…" : "Confirm & Add Expense"}
				</button>
			</div>
		</div>
	);
}
