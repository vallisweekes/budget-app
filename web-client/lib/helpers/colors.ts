import { SIMPLE_COLOR_CLASSES, type SimpleColorKey } from "@/lib/constants/colors";

export function getSimpleColorClasses(color: string | undefined, fallback: SimpleColorKey = "blue") {
	const key = (color ?? fallback) as SimpleColorKey;
	return SIMPLE_COLOR_CLASSES[key] ?? SIMPLE_COLOR_CLASSES[fallback];
}
