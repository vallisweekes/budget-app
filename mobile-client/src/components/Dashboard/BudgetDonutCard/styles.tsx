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
