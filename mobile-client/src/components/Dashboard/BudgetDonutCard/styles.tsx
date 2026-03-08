import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		marginBottom: 16,
		paddingTop: 16,
		paddingBottom: 8,
		alignItems: "center",
	},
	legendRow: {
		marginTop: 14,
		flexDirection: "row",
		gap: 8,
		justifyContent: "center",
		flexWrap: "wrap",
		paddingHorizontal: 12,
	},
	legendChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "rgba(255,255,255,0.04)",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.06)",
	},
	legendDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	legendLabel: {
		color: T.textDim,
		fontSize: 11,
		fontWeight: "700",
	},
	legendValue: {
		color: T.text,
		fontSize: 11,
		fontWeight: "800",
	},
	centerWrap: {
		position: "absolute",
		top: 0,
		left: 0,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	centerKicker: {
		color: T.textDim,
		fontSize: 12,
		fontWeight: "800",
		letterSpacing: 0.6,
		textTransform: "uppercase",
		marginBottom: 6,
	},
	centerValue: {
		color: T.text,
		fontSize: 26,
		fontWeight: "900",
		letterSpacing: -0.5,
	},
	centerSub: {
		marginTop: 6,
		color: T.textDim,
		fontSize: 13,
		fontWeight: "600",
	},
});
