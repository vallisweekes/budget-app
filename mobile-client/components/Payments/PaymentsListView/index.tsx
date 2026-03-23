import React from "react";
import { Image, Pressable, RefreshControl, SectionList, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import { s } from "@/components/PaymentsScreen/style";
import type { PaymentsListViewProps, PaymentsListViewRenderRowArgs } from "@/types";

export default function PaymentsListView({
  query,
  onQueryChange,
  showSearch = true,
  sections,
  fallbackNotice,
  refreshing,
  onRefresh,
  currency,
  showEmpty,
  onOpenItem,
}: PaymentsListViewProps) {
  const [failedLogos, setFailedLogos] = React.useState<Record<string, boolean>>({});

  const renderRow = React.useCallback(
    ({ item, section }: PaymentsListViewRenderRowArgs) => {
      const kind = String(section?.title).toLowerCase() === "debts" ? "debt" : "expense";
      const logoKey = `${kind}:${item.id}`;
      const logoUri = resolveLogoUri(item.logoUrl ?? null);
      const showLogo = Boolean(logoUri) && !failedLogos[logoKey];

      return (
        <Pressable
          onPress={() => {
            onOpenItem({ kind, id: item.id, name: item.name, dueAmount: item.dueAmount, logoUrl: item.logoUrl ?? null });
          }}
          style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        >
          <View style={s.rowLeft}>
            <View style={s.rowAvatar}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri as string }}
                  style={s.rowAvatarLogo}
                  resizeMode="cover"
                  onError={() => setFailedLogos((prev) => ({ ...prev, [logoKey]: true }))}
                />
              ) : (
                <Text style={s.rowAvatarTxt}>{(item.name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
              )}
            </View>
            <Text style={s.rowName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={s.rowAmt} numberOfLines={1}>
            {fmt(item.dueAmount, currency)}
          </Text>
        </Pressable>
      );
    },
    [currency, failedLogos, onOpenItem]
  );

  return (
    <>
      {showSearch ? (
        <View style={[s.searchWrap, { marginTop: 10 }]}> 
          <Ionicons name="search" size={16} color={T.textDim} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search"
            placeholderTextColor={T.textMuted}
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      <SectionList
        sections={sections as any}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        ListHeaderComponent={
          fallbackNotice ? (
            <View style={s.fallbackNoticeWrap}>
              <Ionicons name="calendar-outline" size={14} color={T.orange} />
              <Text style={s.fallbackNoticeText}>{fallbackNotice}</Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          showEmpty ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No payments due this period</Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
    </>
  );
}
