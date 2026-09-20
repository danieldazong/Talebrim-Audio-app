// TEMPORARY design-system specimen. Delete once verified — AGENTS.md
// § Code Simplicity: "Delete dead code rather than commenting it out."
import { ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/theme";

const SWATCHES = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["raised", "bg-raised"],
  ["ember", "bg-ember"],
  ["ember-pressed", "bg-ember-pressed"],
  ["teal", "bg-teal"],
  ["blush", "bg-blush"],
  ["champagne", "bg-champagne"],
  ["body", "bg-body"],
  ["muted", "bg-muted"],
  ["reader-light", "bg-reader-light"],
  ["reader-sepia", "bg-reader-sepia"],
  ["ink", "bg-ink"],
  ["destructive", "bg-destructive"],
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-8">
      <Text className="mb-3 font-ui-semibold text-xs uppercase text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function Specimen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      {/* 1 · Colors — proves the existing tokens still compile. */}
      <Section title="1 · Colors">
        <View className="flex-row flex-wrap gap-2">
          {SWATCHES.map(([name, cls]) => (
            <View key={name} className="items-center">
              <View
                className={`h-12 w-12 rounded-cover border border-muted/30 ${cls}`}
              />
              <Text className="mt-1 font-ui text-[10px] text-muted">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      {/* 2 · Fonts — THE critical test. All four must look different.
          If they are identical, the family names do not match the
          useFonts map keys. */}
      <Section title="2 · Fonts">
        <Text className="font-display text-3xl text-champagne">
          Talebrim Aa 123
        </Text>
        <Text className="font-body text-reader text-body">
          Talebrim Aa 123
        </Text>
        <Text className="font-ui text-base text-body">Talebrim Aa 123</Text>
        <Text className="font-ui-semibold text-base text-body">
          Talebrim Aa 123
        </Text>
      </Section>

      {/* 3 · Negative control — must look IDENTICAL to plain font-display.
          If heavier, Android is faux-bolding an already-semibold face. */}
      <Section title="3 · Weight-class negative control">
        <Text className="font-display text-2xl text-champagne">
          Fraunces alone
        </Text>
        <Text className="font-display text-2xl font-semibold text-champagne">
          Fraunces + font-semibold
        </Text>
      </Section>

      {/* 4 · Buttons — proves @utility + @apply survive the web→native
          compile, and that bg-blush/20 resolves via color-mix. */}
      <Section title="4 · Buttons">
        <View className="flex-row flex-wrap gap-3">
          <View className="btn btn--primary">
            <Text className="font-ui-semibold text-base text-ink">Primary</Text>
          </View>
          <View className="btn btn--secondary">
            <Text className="font-ui-semibold text-base text-body">
              Secondary
            </Text>
          </View>
          <View className="btn btn--inverted">
            <Text className="font-ui-semibold text-base text-champagne">
              Inverted
            </Text>
          </View>
          <View className="btn btn--outlined">
            <Text className="font-ui-semibold text-base text-body">
              Outlined
            </Text>
          </View>
        </View>
      </Section>

      {/* 5 · Progress — utilities composing with a dynamic inline width. */}
      <Section title="5 · Progress">
        <View className="gap-3">
          <View className="progress">
            <View className="progress__fill" style={{ width: "70%" }} />
          </View>
          <View className="progress">
            <View
              className="progress__fill progress__fill--teal"
              style={{ width: "55%" }}
            />
          </View>
          <View className="progress">
            <View
              className="progress__fill progress__fill--blush"
              style={{ width: "35%" }}
            />
          </View>
        </View>
      </Section>

      {/* 6 · Radius — visibly 16 / 12 / fully round. */}
      <Section title="6 · Radius">
        <View className="flex-row gap-3">
          <View className="h-16 w-16 rounded-card bg-surface" />
          <View className="h-16 w-16 rounded-cover bg-surface" />
          <View className="h-16 w-16 rounded-pill bg-surface" />
        </View>
      </Section>

      {/* 7 · Nav pill — BEM modifier and the ember active circle. */}
      <Section title="7 · Bottom nav">
        <View className="nav">
          <View className="nav__item nav__item--active">
            <Text className="font-ui text-xs text-ink">Dis</Text>
          </View>
          <View className="nav__item">
            <Text className="font-ui text-xs text-muted">Lib</Text>
          </View>
          <View className="nav__item">
            <Text className="font-ui text-xs text-muted">Pro</Text>
          </View>
        </View>
      </Section>

      {/* 8 · Search field — the TS mirror reaching a prop className cannot. */}
      <Section title="8 · Search field">
        <View className="field">
          <TextInput
            placeholder="Search"
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              color: colors.body,
              fontFamily: "Inter-Regular",
              fontSize: 16,
            }}
          />
        </View>
      </Section>

      {/* 9 · Card + chips. */}
      <Section title="9 · Card & chips">
        <View className="card">
          <Text className="text-heading mb-3 text-xl">Werewolf Nights</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="chip chip--selected">
              <Text className="font-ui-medium text-sm text-ink">Romance</Text>
            </View>
            <View className="chip">
              <Text className="font-ui-medium text-sm text-body">Werewolf</Text>
            </View>
            <View className="chip">
              <Text className="font-ui-medium text-sm text-body">Fantasy</Text>
            </View>
          </View>
        </View>
      </Section>

      {/* 10 · Icon buttons. */}
      <Section title="10 · Icon buttons">
        <View className="flex-row gap-3">
          <View className="icon-btn" />
          <View className="icon-btn icon-btn--round" />
          <View className="icon-btn icon-btn--round bg-teal/20" />
          <View className="icon-btn icon-btn--round bg-ember/20" />
        </View>
      </Section>
    </ScrollView>
  );
}
