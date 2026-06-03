import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { flatInput, flatInputLabel } from "@/lib/ui";

const GLASS_SURFACE = "rgba(20,24,38,0.56)";
const GLASS_BORDER = "rgba(244,246,255,0.16)";
const SHEET_BACKDROP = "rgba(2,4,10,0.62)";

export const styles = StyleSheet.create({
	sheetOverlay: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: SHEET_BACKDROP,
	},
	sheet: {
		backgroundColor: T.card,
		borderTopLeftRadius: 18,
		borderTopRightRadius: 18,
		borderTopWidth: 1,
		borderTopColor: T.border,
		paddingHorizontal: 16,
		paddingTop: 14,
		paddingBottom: 20,
		gap: 8,
	},
	sheetTall: {
		height: "88%",
		maxHeight: "90%",
	},
	moneyEditorSheet: {
		backgroundColor: T.bg,
		borderTopColor: GLASS_BORDER,
	},
	sheetHandle: {
		alignSelf: "center",
		width: 46,
		height: 5,
		borderRadius: 999,
		backgroundColor: T.border,
		marginBottom: 4,
	},
	sheetKeyboardWrap: {
		flex: 1,
		justifyContent: "flex-end",
	},
	sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", marginBottom: 6 },
	sheetBody: {
		flex: 1,
		minHeight: 0,
	},
	sheetContentWrap: {
		flex: 1,
		minHeight: 0,
	},
	sheetScroll: {
		flex: 1,
	},
	sheetScrollContent: {
		gap: 8,
		paddingBottom: 10,
	},
	moneyEditorHeader: {
		borderRadius: 18,
		backgroundColor: GLASS_SURFACE,
		borderWidth: 1,
		borderColor: GLASS_BORDER,
		paddingHorizontal: 16,
		paddingTop: 14,
		paddingBottom: 16,
		marginBottom: 10,
		alignItems: "center",
		gap: 6,
	},
	moneyEditorIconCircle: {
		width: 42,
		height: 42,
		borderRadius: 21,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(124,92,255,0.18)",
		borderWidth: 1,
		borderColor: "rgba(124,92,255,0.34)",
	},
	moneyEditorHeroTitle: {
		color: T.text,
		fontSize: 15,
		fontWeight: "800",
	},
	moneyEditorHeroValue: {
		color: T.text,
		fontSize: 46,
		fontWeight: "900",
		letterSpacing: -0.6,
		lineHeight: 52,
	},
	moneyEditorStatsRow: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 8,
	},
	moneyEditorStatCard: {
		flex: 1,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: GLASS_BORDER,
		backgroundColor: "rgba(255,255,255,0.04)",
		paddingVertical: 10,
		paddingHorizontal: 12,
		alignItems: "center",
		gap: 2,
	},
	moneyEditorStatLabel: {
		color: T.textDim,
		fontSize: 12,
		fontWeight: "700",
	},
	moneyEditorStatValue: {
		color: T.text,
		fontSize: 22,
		fontWeight: "900",
	},
	label: { ...flatInputLabel },
	presetWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	presetPill: {
		borderRadius: 999,
		borderWidth: 1,
		borderColor: T.border,
		backgroundColor: T.cardAlt,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	presetPillActive: {
		borderColor: T.accent,
		backgroundColor: `${T.accent}22`,
	},
	presetPillText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
	presetPillTextActive: { color: T.accent, fontWeight: "800" },
	input: {
		...flatInput,
	},
	sheetActionsDocked: {
		flexDirection: "row",
		gap: 10,
		marginTop: 8,
		paddingTop: 10,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: T.border,
		backgroundColor: T.card,
	},
	moneyEditorDockedActions: {
		backgroundColor: T.bg,
		borderTopColor: GLASS_BORDER,
	},
	footerActionButton: {
		flex: 1,
	},
	disabled: { opacity: 0.6 },
});
