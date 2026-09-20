Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/02-auth-screen.png — ensure everything is as is
shown. This prompt builds the screen only; behaviour is mocked and prompt 06
replaces the mock.

1. Build M1 as one combined sign-in and sign-up screen at `app/(auth)/sign-in.tsx`
   inside an `(auth)` group with `headerShown: false`
   (https://docs.expo.dev/router/advanced/stack/). No bottom tab bar, no mini
   player, no back button — this is the app's entry point.
2. Top third is a cover collage rendered from `auth-header.png` via
   `constants/images.ts` with `expo-image`. You may not generate, download or
   hotlink that image. If it is not in `assets/images/`, render a
   `bg-plum-raised` block of the correct height, leave a `// MISSING ASSET`
   comment, and list it in your summary — do not substitute a remote URL,
   an Unsplash or Picsum link, or an emoji.
3. Below the collage: the headline "Pick up where you left off" in Fraunces 600,
   then the buttons. Google and Apple pill buttons only — no Facebook, even if the
   material shows one. Then an email `TextInput` and a "Continue with email" pill.
   The email pill is the single ember element on this screen; Google and Apple are
   outline variants. Ember button labels use `ink #1A1420`, never white.
4. Use the `Button`, `Chip`, `Heading`, `Body` and `Screen` primitives from
   prompt 02. Do not restyle them locally and do not create a second button
   implementation. `className` only, except where the AGENTS.md style-exception
   table permits `style`.
5. The email field must set `keyboardType="email-address"`,
   `autoCapitalize="none"`, `autoCorrect={false}` and one of `autoComplete` /
   `textContentType` for autofill — not both, since `textContentType` takes
   precedence on iOS (https://reactnative.dev/docs/textinput). Wrap the form in
   `KeyboardAvoidingView` (https://docs.expo.dev/guides/keyboard-handling/) so the
   pill is never covered on either platform.
6. Render every state with local component state and no network: idle, email
   invalid (inline message, no alert dialog), submitting (button disabled with a
   spinner, label text preserved so the pill does not resize), and error (inline,
   surface-matched, not a red toast). Validate format only — do not check whether
   an account exists.
7. Build the verification step as a real screen at
   `app/(auth)/verify.tsx`: six-digit code entry, resend affordance, and inline
   error. Mock the submit with a delay and accept any six digits. Mark it
   `// MOCK — prompt 06 wires Clerk email code`. Do not use `Alert.alert` as a
   stand-in for a screen.
8. Legal line at the bottom. AGENTS.md specifies an 18+ line while the design
   material reads "17+", and the material's wordmark reads "NovelNow" while the
   product is talebrim. Render the AGENTS.md 18+ wording and the name talebrim,
   then report both conflicts in your summary. Do not silently pick one.
9. Post-auth routing is conditional and must be implemented as a single function
   now, even against mocked auth: a first-time user goes to the genre picker (M2),
   a returning user goes to Discover (M3). Leave `// TODO(08)` where the persisted
   completion flag will decide, and default to M2 until then.
10. Keep the temporary link from `app/index.tsx` to this screen so it is reachable
    before real routing exists. Mark it scaffolding for prompt 09.

Do not: call Clerk, `useSignIn`, `useSignUp` or Supabase anywhere in this prompt;
use `<SignIn />`, `<SignUp />` or any Clerk prebuilt component, or the hosted web
sign-in flow; add a password field — M1 shows an email input with no password, so
this is a passwordless email-code flow; add a "forgot password" link, a phone
option, a magic-link deep link, or a third social provider; build M2, M3 or a tab
bar; add a gradient, glow, blur or shadow; put white text on ember; fetch or
create imagery.

Finish by running `npx tsc --noEmit`, then paste screenshots or a description of
all four states from step 6, confirm the keyboard never covers the pill on iOS and
Android, and list the missing asset from step 2 and the two copy conflicts from
step 8.

Next prompt: `06-auth-clerk.md`.
