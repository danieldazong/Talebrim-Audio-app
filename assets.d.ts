// Ambient types for static image assets imported through Metro.
//
// Expo's shipped typings (expo/types) cover `require`, the router and
// react-native-web, but nothing in this toolchain declares image modules, so
// `import logo from "@/assets/Image/logo.png"` has no type. Metro resolves
// these to an opaque asset id (a number) at runtime, or to a URI object on
// web; `ImageSourcePropType` is what react-native and expo-image both accept.

declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}

declare module "*.jpg" {
  import type { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}

declare module "*.jpeg" {
  import type { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}

declare module "*.webp" {
  import type { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}

declare module "*.svg" {
  import type { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}
