"use client";

import { useCallback, useRef, useState } from "react";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";
import type { MonthKey } from "@/types";
import { fileToBase64 } from "@/lib/helpers/fileToBase64";
import ReceiptUploadDropzone from "@/components/Expenses/ExpenseManager/ReceiptUploadDropzone";
import ReceiptUploadConfirmForm from "@/components/Expenses/ExpenseManager/ReceiptUploadConfirmForm";

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
			{!scanResult ? (
				<ReceiptUploadDropzone
					dragOver={dragOver}
					preview={preview}
					scanning={scanning}
					inputRef={inputRef}
					onFileInput={handleFileInput}
					onDrop={handleDrop}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
				/>
			) : null}

			{scanError && (
				<p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
					{scanError}
				</p>
			)}

			{/* Editable confirmation form */}
			{scanResult ? (
				<ReceiptUploadConfirmForm
					scanResult={scanResult}
					preview={preview}
					month={month}
					year={year}
					categories={categories}
					name={name}
					amount={amount}
					date={date}
					categoryId={categoryId}
					confirming={confirming}
					onChangeName={setName}
					onChangeAmount={setAmount}
					onChangeDate={setDate}
					onChangeCategoryId={setCategoryId}
					onReset={handleReset}
					onConfirm={() => void handleConfirm()}
				/>
			) : null}
		</div>
	);
}
