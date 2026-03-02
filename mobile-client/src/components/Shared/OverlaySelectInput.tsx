import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";

type Option = {
  value: string;
  label: string;
  activeColor?: string;
};

type Props = {
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  placeholder?: string;
  containerStyle?: any;
  triggerStyle?: any;
};

export default function OverlaySelectInput({
  value,
  options,
  onChange,
  placeholder = "Select",
  containerStyle,
  triggerStyle,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((opt) => opt.value === value);

  return (
    <View style={[s.anchor, containerStyle]}>
      <Pressable style={triggerStyle} onPress={() => setOpen((prev) => !prev)}>
        <View style={s.valueRow}>
          <Text style={s.valueText}>{selected?.label ?? placeholder}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={T.textDim} />
        </View>
      </Pressable>

      {open ? (
        <View style={s.menu}>
          {options.map((opt, idx) => {
            const active = opt.value === value;
            const activeColor = opt.activeColor ?? T.accent;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={[s.item, idx === options.length - 1 && s.itemLast, active && s.itemActive]}
              >
                <Text style={[s.itemText, active && { color: activeColor, fontWeight: "800" }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  anchor: {
    position: "relative",
    zIndex: 20,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    top: 46,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    zIndex: 30,
    elevation: 8,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemActive: {
    backgroundColor: `${T.accent}20`,
  },
  itemText: {
    color: T.text,
    fontSize: 13,
    fontWeight: "700",
  },
});
