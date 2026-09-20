# Design system reference

The class vocabulary available when building screens. Verified against a real
Android bundle on 2026-09-20.

**Source of truth is [`src/global.css`](../src/global.css)** — the `@theme`
block is the single place raw hex appears (AGENTS.md § Styling Rules; Tailwind
v4 + NativeWind v5 are CSS-first, so there is no `tailwind.config.js` and one
must not be created). This file is a usage guide, not a second definition.
For the *design rules* — when to use ember, contrast targets, screen specs —
see AGENTS.md § Design System.

---

## Colors

`bg-*`, `text-*`, `border-*` all accept these:

| Class token | Hex | Use |
|---|---|---|
| `bg` | `#150E1F` | Screen background |
| `surface` | `#1F1530` | Cards |
| `raised` | `#2C1E42` | Nav, modals, sheets, toolbars |
| `ember` | `#E8663F` | Primary CTA, progress, active tab |
| `ember-pressed` | `#FF8A5C` | Pressed state only |
| `teal` | `#9FD8D0` | Secondary accent, audio affordances |
| `blush` | `#E9A8C0` | Decorative chips and labels only |
| `champagne` | `#F4E3CE` | Serif headings on dark |
| `body` | `#F7F4F0` | Body text on dark |
| `muted` | `#A79BB5` | Captions, metadata, inactive nav |
| `reader-light` | `#FBF7F1` | Reader light mode |
| `reader-sepia` | `#F2E5D0` | Reader sepia mode |
| `ink` | `#1A1420` | Text on light surfaces, **and labels on ember buttons** |
| `destructive` | `#C9705F` | Sign-out, destructive links |

Opacity modifiers work and cost nothing at runtime: `bg-blush/20` compiles to
a baked `#e9a8c033` at build time via lightningcss.

Rules that classes cannot enforce, from AGENTS.md § Design System: **exactly
one ember element per screen**, on the primary action; blush is decorative
only, never body text; no shadows or gradients except the one on M6.

## Typography

**One family per weight.** React Native cannot select a weight from a family:
`font-semibold` emits a separate `font-weight` prop that does **not** pick a
SemiBold file. The weight is baked into the token name, so never pair these
with a font-weight utility — at best a no-op, at worst a faux-bold over a real
semibold face.

| Class | Family | Use |
|---|---|---|
| `font-display` | Fraunces SemiBold | Titles and headings, in champagne |
| `font-body` | Literata Regular | Reader body text only |
| `font-body-italic` | Literata Italic | Reader emphasis |
| `font-body-emphasis` | Literata SemiBold | Reader strong |
| `font-ui` | Inter Regular | All UI chrome |
| `font-ui-medium` | Inter Medium | UI chrome, slight emphasis |
| `font-ui-semibold` | Inter SemiBold | Buttons, labels |

`text-reader` sets 18px with line-height 1.7 — the reader body spec. Named
`reader` rather than `body` because Tailwind v4's `--text-*` namespace also
feeds `--text-color`, which would make `--text-body` ambiguous against
`--color-body`.

> **Status:** only Fraunces is loaded. The six static Inter and Literata files
> are not in `assets/fonts/` yet, so `font-body` and `font-ui*` currently fall
> back to the system font. See [`src/lib/fonts.ts`](../src/lib/fonts.ts) —
> uncomment the entries once the files land. Atkinson Hyperlegible Next has a
> token but is deliberately never loaded; `readerFontFamily()` maps it to
> Literata.

## Radius

`rounded-card` 16dp · `rounded-cover` 12dp (2:3 covers) · `rounded-field` 12dp
· `rounded-pill` fully round.

## Spacing

Tailwind's default scale **is** the 8pt grid — `p-4` is 16dp, the standard side
padding. Do not override `--spacing`; every numeric utility is
`calc(var(--spacing) * N)` and changing it silently rescales everything. The
56dp mini player is `h-14`.

## Components

Compose a base class with its modifiers: `className="btn btn--primary"`.

```
btn              base pill, 44dp min touch target, Inter SemiBold 16
  btn--primary     ember fill, ink label
  btn--secondary   raised fill, body label
  btn--inverted    blush/20 fill, champagne label
  btn--outlined    transparent, muted/40 border, body label

chip             outlined pill, Inter Medium 14
  chip--selected   blush fill, ink label

progress         track, 6dp, raised
  progress__fill         ember
  progress__fill--teal
  progress__fill--blush

nav              raised pill, 56dp, three items
  nav__item              44dp circle
  nav__item--active      ember fill

card             surface, 16dp radius, 16dp padding
field            search/input wrapper, raised, 48dp
icon-btn         44dp tinted square
  icon-btn--round        circular

text-heading     Fraunces + champagne
text-reader-body Literata + 18px/1.7
```

**Progress fill width is an inline style**, not a class — it is computed at
runtime (AGENTS.md § Style Exception Rules):

```tsx
<View className="progress">
  <View className="progress__fill" style={{ width: `${pct}%` }} />
</View>
```

Pressed, disabled and selected states are `Pressable` props, not CSS
pseudo-classes. Every interactive component needs its full state set and an
accessibility label.

## When className will not work

Some React Native props take no `className`. For those, and **only** those,
import the typed mirror from [`src/theme/`](../src/theme):

```tsx
import { colors, fonts, radius, layout } from "@/theme";
```

Covers `SafeAreaView`, `StatusBar`, `Stack` `contentStyle`, `Modal`,
`TextInput` `placeholderTextColor`, `expo-linear-gradient` color arrays,
`react-native-svg` props, and runtime-computed values. `nowPlayingGradient` is
the app's only gradient (M6).

`src/theme/` is a **mirror, not a source of truth** — change a value there and
you must change it in `global.css` too. Never reach for it to do something a
className could do. The full list of exceptions is AGENTS.md § Style Exception
Rules.

## Gotchas

- **`npx expo start -c` after editing `global.css`.** The CSS→RN stylesheet is
  cached; this is the most common reason a token change appears not to work.
- **A `@utility` class only compiles if Tailwind sees it used** in a file
  matched by the `@source` globs (`src/app/**`, `src/components/**`). If a
  class silently does nothing, it was tree-shaken for lack of a usage site.
- **CSS fallback stacks are discarded on native.** NativeWind takes only the
  first family name, so `font-family: Literata, Georgia, serif` becomes
  `Literata` alone.
