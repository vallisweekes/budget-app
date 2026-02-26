"use client";

import useReceiptUploadPanel from "@/lib/hooks/expenses/useReceiptUploadPanel";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";
import type { MonthKey } from "@/types";
import ReceiptUploadDropzone from "@/components/Expenses/ExpenseManager/ReceiptUploadDropzone";
import ReceiptUploadConfirmForm from "@/components/Expenses/ExpenseManager/ReceiptUploadConfirmForm";

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
	const {
		dragOver,
		scanning,
		scanError,
		preview,
		scanResult,
		name,
		amount,
		date,
		categoryId,
		confirming,
		inputRef,
		setDragOver,
		setName,
		setAmount,
		setDate,
		setCategoryId,
		handleFileInput,
		handleDrop,
		handleConfirm,
		handleReset,
	} = useReceiptUploadPanel({ budgetPlanId, month, year, categories, onAdded, onError });

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
