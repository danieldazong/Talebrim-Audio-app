import { Text, type TextProps } from "react-native";

type Props = {
  className?: string;
} & Omit<TextProps, "className">;

/** Fraunces heading in champagne — AGENTS.md § Design System. */
export function Heading({ className = "", ...rest }: Props) {
  return (
    <Text
      className={`text-heading text-3xl leading-9 ${className}`}
      maxFontSizeMultiplier={1.3}
      {...rest}
    />
  );
}

/** Inter UI copy. `muted` by default; pass `text-body` for higher contrast. */
export function Body({ className = "", ...rest }: Props) {
  return (
    <Text
      className={`font-ui text-muted text-base leading-6 ${className}`}
      maxFontSizeMultiplier={1.5}
      {...rest}
    />
  );
}
