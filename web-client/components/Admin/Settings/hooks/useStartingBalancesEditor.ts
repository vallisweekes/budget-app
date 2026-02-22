import { useTransition, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function useStartingBalancesEditor({
	router,
	onSave,
}: {
	router: AppRouterInstance;
	onSave: (formData: FormData) => Promise<void> | void;
}): {
	isEditing: boolean;
	setIsEditing: (next: boolean) => void;
	isSaving: boolean;
	saveAction: (formData: FormData) => void;
} {
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, startSaving] = useTransition();

	const saveAction = (formData: FormData) => {
		startSaving(async () => {
			await onSave(formData);
			setIsEditing(false);
			router.refresh();
		});
	};

	return { isEditing, setIsEditing, isSaving, saveAction };
}
