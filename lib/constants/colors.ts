export const SIMPLE_COLOR_CLASSES = {
	blue: { bg: "from-blue-400 to-blue-600", text: "text-blue-600" },
	yellow: { bg: "from-yellow-400 to-yellow-600", text: "text-yellow-600" },
	purple: { bg: "from-purple-400 to-purple-600", text: "text-purple-600" },
	orange: { bg: "from-orange-400 to-orange-600", text: "text-orange-600" },
	green: { bg: "from-green-400 to-green-600", text: "text-green-600" },
	indigo: { bg: "from-indigo-400 to-indigo-600", text: "text-indigo-600" },
	pink: { bg: "from-pink-400 to-pink-600", text: "text-pink-600" },
	cyan: { bg: "from-cyan-400 to-cyan-600", text: "text-cyan-600" },
	red: { bg: "from-red-400 to-red-600", text: "text-red-600" },
	emerald: { bg: "from-emerald-400 to-emerald-600", text: "text-emerald-600" },
} as const;

export type SimpleColorKey = keyof typeof SIMPLE_COLOR_CLASSES;
