export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

export type SelectDropdownProps = {
	options: SelectOption[];
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
	name?: string;
	disabled?: boolean;
	required?: boolean;
	variant?: "dark" | "light";
	className?: string;
	buttonClassName?: string;
	menuClassName?: string;
	id?: string;
};
