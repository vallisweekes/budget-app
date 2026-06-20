import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useAppLocale, useAppTranslation } from "@/hooks";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import { styles as s } from "@/components/Expenses/AddExpenseSheet/styles";

export default function AddExpenseSheetHeader({
  month,
  year,
  title,
  canPrev = true,
  onPrevMonth,
  onNextMonth,
  onClose,
}: {
  month: number;
  year: number;
  title?: string;
  canPrev?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onClose: () => void;
}) {
  const { settings } = useBootstrapData();
  const { locale, monthNamesShort } = useAppLocale();
  const { t } = useAppTranslation();
  const safeMonth = Math.max(1, Math.min(12, month));
  const fallbackStart = monthNamesShort[(safeMonth + 10) % 12];
  const fallbackEnd = monthNamesShort[(safeMonth + 11) % 12];
  const fallbackLabel = `${fallbackStart} - ${fallbackEnd}`;
  const label = React.useMemo(() => {
    const payDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
      ? Math.floor(settings?.payDate as number)
      : 27;
    const payFrequency = normalizePayFrequency(settings?.payFrequency);
    const payAnchorDate = payFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null);

    try {
      const period = buildPayPeriodFromMonthAnchor({
        year,
        month: safeMonth,
        payDate,
        payFrequency,
        payAnchorDate,
      });
      return formatPayPeriodLabel(period.start, period.end, locale);
    } catch {
      return fallbackLabel;
    }
  }, [fallbackLabel, locale, safeMonth, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency, year]);

  return (
    <View style={s.header}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.title}>{title ?? t("expenses.addExpenseTitle")}</Text>
        <View style={s.periodRail}>
          <Pressable
            onPress={onPrevMonth}
            hitSlop={10}
            disabled={!canPrev}
            style={[s.periodIconBtn, !canPrev && s.periodIconBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={16} color={T.text} />
          </Pressable>
          <Text style={s.periodText} numberOfLines={1}>
            {label}
          </Text>
          <Pressable onPress={onNextMonth} hitSlop={10} style={s.periodIconBtn}>
            <Ionicons name="chevron-forward" size={16} color={T.text} />
          </Pressable>
        </View>
      </View>
      <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
        <Ionicons name="close" size={20} color={T.textDim} />
      </Pressable>
    </View>
  );
}
