"use client";

import { useCallback, useRef, useState } from "react";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";
import type { MonthKey } from "@/types";
import { SelectDropdown } from "@/components/Shared";

type ScanResult = {
	receiptId: string;
	merchant: string | null;
	amount: number | null;
	currency: string | null;
	date: string | null;
	suggestedCategory: string | null;
};

type Props = {
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	categories: ExpenseCategoryOption[];
	onAdded: () => void;
	onError: (message: string) => void;
};

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
			const base64 = result.split(",")[1] ?? result;
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export default function ReceiptUploadPanel({
	budgetPlanId,
	month,
	year,
	categories,
	onAdded,
	onError,
}: Props) {
	const [dragOver, setDragOver] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);
	const [preview, setPreview] = useState<string | null>(null);

	// Editable form state (populated after scan)
	const [scanResult, setScanResult] = useState<ScanResult | null>(null);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [confirming, setConfirming] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);

	const processFile = useCallback(
		async (file: File) => {
			if (!file.type.startsWith("image/")) {
				setScanError("Please upload an image file (JPEG, PNG, etc.).");
				return;
			}
			// Show preview
			const objectUrl = URL.createObjectURL(file);
			setPreview(objectUrl);
			setScanError(null);
			setScanning(true);
			setScanResult(null);

			try {
				const base64 = await fileToBase64(file);
				const res = await fetch("/api/scan-receipt", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ imageBase64: base64, budgetPlanId: budgetPlanId || undefined }),
				});

				const data = await res.json() as ScanResult & { error?: string };

				if (!res.ok || data.error) {
					setScanError(data.error ?? "Receipt scanning failed. Please try again or enter details manually.");
					setScanning(false);
					return;
				}

				setScanResult(data);
				setName(data.merchant ?? "");
				setAmount(data.amount != null ? String(data.amount) : "");
				setDate(data.date ?? "");

				// Match the suggested category by name
				if (data.suggestedCategory) {
					const match = categories.find(
						(c) => c.name.toLowerCase() === data.suggestedCategory!.toLowerCase(),
					);
					setCategoryId(match?.id ?? "");
				} else {
					setCategoryId("");
				}
			} catch {
				setScanError("Could not reach the server. Please check your connection.");
			} finally {
				setScanning(false);
			}
		},
		[budgetPlanId, categories],
	);

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) void processFile(file);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files[0];
		if (file) void processFile(file);
	};

	const handleConfirm = async () => {
		if (!scanResult || !name.trim() || !amount) return;
		setConfirming(true);
		setScanError(null);

		// Derive month/year from the scanned date or fall back to the parent's month/year
		let confirmMonth = typeof month === "number" ? month : parseInt(String(month), 10);
		let confirmYear = year;
		if (date) {
			const d = new Date(date);
			if (!isNaN(d.getTime())) {
				confirmMonth = d.getMonth() + 1;
				confirmYear = d.getFullYear();
			}
		}

		try {
			const res = await fetch("/api/confirm-expense", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					receiptId: scanResult.receiptId,
					merchant: name.trim(),
					amount: parseFloat(amount),
					expenseDate: date || `${confirmYear}-${String(confirmMonth).padStart(2, "0")}-01`,
					categoryId: categoryId || undefined,
					budgetPlanId: budgetPlanId || undefined,
				}),
			});

			const data = await res.json() as { success?: boolean; error?: string };

			if (!res.ok || !data.success) {
				const msg = data.error ?? "Could not confirm receipt. Please try again.";
				setScanError(msg);
				onError(msg);
			} else {
				onAdded();
				// Reset
				setScanResult(null);
				setPreview(null);
				setName("");
				setAmount("");
				setDate("");
				setCategoryId("");
			}
		} catch {
			const msg = "Could not reach the server. Please try again.";
			setScanError(msg);
			onError(msg);
		} finally {
			setConfirming(false);
		}
	};

	const handleReset = () => {
		setScanResult(null);
		setPreview(null);
		setName("");
		setAmount("");
		setDate("");
		setCategoryId("");
		setScanError(null);
		if (inputRef.current) inputRef.current.value = "";
	};

	return (
		<div className="space-y-6">
			{/* Dropzone / upload area */}
			{!scanResult && (
				<div
					className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer ${
						dragOver
							? "border-purple-400 bg-purple-500/10"
							: "border-white/20 bg-slate-900/30 hover:border-white/40 hover:bg-slate-900/50"
					}`}
					onClick={() => inputRef.current?.click()}
					onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					role="button"
					tabIndex={0}
					onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
					aria-label="Upload receipt image"
				>
					<input
						ref={inputRef}
						type="file"
						accept="image/*"
						capture="environment"
						className="sr-only"
						onChange={handleFileInput}
					/>

					{preview ? (
						<img
							src={preview}
							alt="Receipt preview"
							className="max-h-48 rounded-xl object-contain shadow-md"
						/>
					) : (
						<>
							<div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/20">
								<svg className="h-7 w-7 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 10l-4-4m0 0L8 10m4-4v12" />
								</svg>
							</div>
							<div className="text-center">
								<p className="text-sm font-semibold text-white">Drop your receipt here</p>
								<p className="mt-1 text-xs text-slate-400">or tap to browse / take a photo</p>
							</div>
						</>
					)}

					{scanning && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/80 backdrop-blur-sm">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
							<p className="text-sm font-medium text-slate-300">Scanning receipt…</p>
						</div>
					)}
				</div>
			)}

			{scanError && (
				<p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
					{scanError}
				</p>
			)}

			{/* Editable confirmation form */}
			{scanResult && (
				<div className="space-y-5">
					<div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
						<svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						<p className="text-sm text-emerald-200">Receipt scanned — review and confirm the details below.</p>
					</div>

					{/* Preview thumbnail + change button */}
					{preview && (
						<div className="flex items-center gap-4">
							<img src={preview} alt="Receipt" className="h-16 w-16 rounded-xl object-cover shadow" />
							<button
								type="button"
								onClick={handleReset}
								className="text-xs text-slate-400 underline underline-offset-2 hover:text-white transition-colors"
							>
								Use a different receipt
							</button>
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						<label className="block">
							<span className="text-sm font-medium text-slate-300 mb-2 block">Merchant / Name</span>
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
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
								onChange={(e) => setAmount(e.target.value)}
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
								onChange={(e) => setDate(e.target.value)}
								className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all [color-scheme:dark]"
							/>
							{date && (() => {
								const d = new Date(date);
								if (!isNaN(d.getTime())) {
									const m = d.getMonth() + 1;
									const y = d.getFullYear();
									const original = typeof month === "number" ? month : parseInt(String(month), 10);
									if (m !== original || y !== year) {
										return (
											<p className="mt-1.5 text-xs text-amber-300">
												Will be logged to {MONTH_NAMES[m - 1]} {y}
											</p>
										);
									}
								}
								return null;
							})()}
						</label>

						<label className="block">
							<span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
							<SelectDropdown
								value={categoryId}
								onValueChange={setCategoryId}
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
							onClick={handleReset}
							className="flex-1 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50 transition-all"
						>
							Discard
						</button>
						<button
							type="button"
							onClick={() => void handleConfirm()}
							disabled={confirming || !name.trim() || !amount}
							className="flex-[2] bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
						>
							{confirming ? "Saving…" : "Confirm & Add Expense"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
