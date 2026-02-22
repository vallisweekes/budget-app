import { formatCurrency } from "@/lib/helpers/money";

export default function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}
