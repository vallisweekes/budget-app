import type { RefObject } from "react";

export default function ReceiptUploadDropzone(props: {
	dragOver: boolean;
	preview: string | null;
	scanning: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onDrop: (e: React.DragEvent) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragLeave: () => void;
}) {
	const { dragOver, preview, scanning, inputRef, onFileInput, onDrop, onDragOver, onDragLeave } = props;

	return (
		<div
			className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer ${
				dragOver
					? "border-purple-400 bg-purple-500/10"
					: "border-white/20 bg-slate-900/30 hover:border-white/40 hover:bg-slate-900/50"
			}`}
			onClick={() => inputRef.current?.click()}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
			}}
			aria-label="Upload receipt image"
		>
			<input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFileInput} />

			{preview ? (
				<img src={preview} alt="Receipt preview" className="max-h-48 rounded-xl object-contain shadow-md" />
			) : (
				<>
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/20">
						<svg className="h-7 w-7 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 10l-4-4m0 0L8 10m4-4v12"
							/>
						</svg>
					</div>
					<div className="text-center">
						<p className="text-sm font-semibold text-white">Drop your receipt here</p>
						<p className="mt-1 text-xs text-slate-400">or tap to browse / take a photo</p>
					</div>
				</>
			)}

			{scanning ? (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/80 backdrop-blur-sm">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
					<p className="text-sm font-medium text-slate-300">Scanning receipt…</p>
				</div>
			) : null}
		</div>
	);
}
