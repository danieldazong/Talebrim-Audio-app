Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/13-profile.png — ensure everything is as is
shown. This is the last screen; it is also where several legal and store
requirements land, so read steps 8 and 9 before starting.

1. Replace the Profile placeholder at `app/(tabs)/profile.tsx`. It keeps the tab
   bar and the mini player, which the prompt-09 map lists as present on M11 —
   bottom padding uses the measured value so the last row is never hidden.
2. Header block from Clerk's `useUser`: display name, email, and the avatar if
   one exists. If there is no avatar, render initials on `plum-raised` — do not
   generate an image, do not fetch a Gravatar or any third-party avatar service,
   and do not hotlink. Never render `metadata.role` or expose it anywhere.
3. Settings rows grouped as the design shows, each bound to real state — no row
   may be decorative. Reader preferences (font size, theme, line spacing) read
   and write the prompt-08 `reader` slice and must reflect changes already made
   in M5's `Aa` sheet; playback preferences (default speed) bind to the
   `playback` slice. The Atkinson Hyperlegible accessibility toggle is installed
   but stays inert here with a `// TODO(28)` marker.
4. Subscription row: show the current entitlement from
   `customerInfo.entitlements.active` per prompt 23 — active plan and renewal
   date if RevenueCat provides them, otherwise a prompt to subscribe that opens
   M10. Never hardcode a plan name or price; read it from the SDK. Include
   Restore Purchases here too if the design has a natural slot, since it is the
   screen users look on.
5. Downloads row: total size on disk and a link into the Library Downloads
   segment, reading the prompt-25 index after its start-up reconciliation. Never
   show an estimated size.
6. Storage/cache row: clearing the TanStack persisted cache is distinct from
   deleting downloaded audio. Offer them separately with honest labels — a user
   who taps "clear cache" must not lose downloaded chapters, and one who deletes
   downloads must not lose their reading positions, which live on the server
   anyway.
7. Sign-out is the destructive-styled row at the bottom. It calls Clerk's
   `signOut()`, then `clearUserScopedState()` from `lib/session.ts`, then
   RevenueCat's `logOut()` per prompt 23 step 4. All three, in one path — a
   sign-out that skips the RevenueCat call leaves the next account on this device
   inheriting the previous customer's entitlement. Confirm before signing out.
8. ACCOUNT DELETION IS MANDATORY, even if the design material omits it. Apps
   supporting account creation must let users initiate deletion in-app
   (https://developer.apple.com/support/offering-account-deletion-in-your-app/).
   Add the row. Deleting the Clerk user from the client is possible via the user
   object (https://clerk.com/docs/expo/reference/objects/user), but the app's
   `reading_positions`, `unlocks` and `library_items` rows are keyed by the Clerk
   id and will NOT be removed by that call, and there is no cascade because those
   tables reference an external identity. STOP and tell me how you intend to
   delete that data — an Edge Function, a Clerk webhook, or a manual process —
   and WAIT for my decision before implementing deletion. Do not ship a deletion
   that orphans user rows, and do not build a webhook on your own initiative.
9. Legal rows: Terms, Privacy Policy, and subscription terms. If those URLs are
   not in AGENTS.md, render the rows and report the URLs as missing — do not
   invent a link, and do not point at a placeholder domain.
10. Version string from `expo-application`'s `nativeApplicationVersion` and
    `nativeBuildVersion` (https://docs.expo.dev/versions/latest/sdk/application/),
    not from `app.json` via `expo-constants`, which reports the manifest rather
    than the installed binary and will disagree after an OTA update. Show both
    version and build so a bug report is actionable.
11. Support or contact row if the design shows one: use a `mailto:` link to an
    address from AGENTS.md. If none is specified, report it as missing rather than
    inventing an address.
12. No ember element is required on this screen. If the design shows one, it is
    the single one, and sign-out and delete-account use the `danger #C0432F`
    status colour for their destructive styling — that is `danger`'s legitimate
    use, and it must not appear anywhere else on the screen.
13. States, surface-matched on `plum-deep`: entitlement loading (skeleton row,
    not a spinner), entitlement unavailable offline (show the last known state
    with an honest label rather than implying the user has no subscription), and
    inline errors with retry. No `Alert.alert` except for the destructive
    confirmations in steps 7 and 8.
14. Accessibility: every row announces its current value, not just its name — a
    toggle says what it is set to, the subscription row reads as one coherent
    label. 44dp minimum targets, `accessibilityRole` on every row, and the
    destructive rows clearly announced as destructive.

Do not: implement account deletion before my answer to step 8; build a Clerk
webhook or an Edge Function on your own initiative; render or read
`metadata.role`; add profile editing, avatar upload, a username change or
notification preferences — none are in the design and notifications have no
backing service; add an analytics SDK or event tracking, which AGENTS.md does not
specify and which needs explicit sign-off; alter any table, policy or view;
hardcode a plan name, price, legal URL or support address; add a gradient, a
second ember element, or raw hex outside `tailwind.config.js`; change any
previous screen except where a shared module requires it.

Finish by running `npx tsc --noEmit`, then paste your account-deletion proposal
from step 8 and STOP for my decision on it, the list of missing URLs and
addresses from steps 9 and 11, confirmation that sign-out calls all three
teardown paths, and a test showing a second account on the same device inherits
neither entitlement, downloads index, nor cached rows.
