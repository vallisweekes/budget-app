"use client";

import type { ReactNode } from "react";
import ConfirmModal from "@/components/Shared/ConfirmModal";

type Props = {
	open: boolean;
	title: string;
	description?: string;
	children?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	isBusy?: boolean;
	confirmDisabled?: boolean;
	onConfirm: () => void;
	onClose: () => void;
};

export default function DeleteConfirmModal({
	open,
	title,
	description,
	children,
	confirmText = "Delete",
	cancelText = "Keep",
	isBusy = false,
	confirmDisabled = false,
	onConfirm,
	onClose,
}: Props) {
	return (
		<ConfirmModal
			open={open}
			title={title}
			description={description}
			confirmText={confirmText}
			cancelText={cancelText}
			tone="danger"
			isBusy={isBusy}
			confirmDisabled={confirmDisabled}
			onConfirm={onConfirm}
			onClose={onClose}
		>
			{children}
		</ConfirmModal>
	);
}
