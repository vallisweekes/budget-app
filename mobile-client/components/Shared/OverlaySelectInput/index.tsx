import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import type { OverlaySelectInputProps } from "@/types";
import { T } from "@/lib/theme";

export default function OverlaySelectInput({
  value,
  options,
  onChange,
  placeholder = "Select",
  containerStyle,
  triggerStyle,
}: OverlaySelectInputProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((opt) => opt.value === value);

  return (
    <View style={[styles.anchor, containerStyle]}>
      <Pressable style={triggerStyle} onPress={() => setOpen((prev) => !prev)}>
        <View style={styles.valueRow}>
          <Text style={styles.valueText}>{selected?.label ?? placeholder}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={T.textDim} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.menu}>
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
                style={[styles.item, idx === options.length - 1 && styles.itemLast, active && styles.itemActive]}
              >
                <Text style={[styles.itemText, active && { color: activeColor, fontWeight: "800" }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
