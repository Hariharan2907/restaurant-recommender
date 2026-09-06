# Fork UI redesign

Fork is an editorial restaurant discovery experience built within the existing Expo 54 / React Native / TypeScript application. Ivory and stone surfaces, olive accents, charcoal text, Georgia headings, real restaurant photography, and restrained motion form the shared visual system. It remains light-only.

## Experience

- Discovery: natural-language search, actionable examples and occasion prompts, search / personalized / discovery modes, location selection, and a reusable filter sheet.
- Refinements: cuisine, maximum price tier, minimum rating, search radius, mood, and dietary requests use the existing search and recommendation endpoints. Dietary compatibility is not asserted as a verified fact.
- Restaurant cards: responsive one-, two-, and three-column layouts, real photo-proxy images, readable ratings and counts, price, address, approximate straight-line distance, dishes when returned, and match explanations. Missing explanations fall back to actual rating/cuisine facts, without claiming personalization.
- Details: responsive gallery, match explanation, review-derived dishes and attribution, dietary guidance, directions, visit logging, and return to discovery. On phones, visit actions appear before the supplementary sections.
- Dining diary: guest and empty states, initial loading, refresh, pagination, duplicate-load prevention, and accessible delete confirmation.
- Taste profile: preferences, account management, save feedback, recoverable errors, and guest onboarding.
- Accounts and visit logging: readable labeled forms, keyboard-aware layouts, compact mobile navigation, and safe disabled states. Sign-up, sign-in, visit submission, and account contracts are preserved.
- Not-found page and shared feedback states follow the same visual system.

All backend code, ranking, authentication providers, API routes, and database schemas are unchanged. Radius is passed using existing optional API fields. Frontend distance calculations are display-only and preserve result order. No restaurant fixtures or invented restaurant data are shipped.

## Shared components and accessibility

`ScreenLayout`, `Button`, `Chip`, `FormField`, `Sheet`, `ConfirmDialog`, `Feedback`, `RestaurantPhoto`, `PhotoImage`, `ResultsList`, and `SearchFilters` provide reusable presentation primitives. Theme tokens live in `mobile/lib/theme.ts`.

The web build has labeled landmarks and dialogs, visible focus rings, Escape dismissal and focus restoration, meaningful image alt text, hidden decorative icon glyphs, readable status announcements, and reduced-motion CSS. Buttons, chips, gallery controls, and ratings use targets of at least 44 px. Mobile sheets have independently scrolling content and persistent apply/close controls. Placeholder text and form boundaries use contrast-aware tokens.

Restaurant images use the existing `/photo` proxy. Web cards use native lazy loading, `srcset`, `sizes`, and reserved image dimensions. Missing or failed images show a local ceramic-plate motif and the restaurant name. Only the Ionicons font is imported, reducing unused icon bundles. The final web JavaScript bundle is about 1.48 MB before transfer compression, down from 1.9 MB during the first overhaul build.

## Validation

Run from `mobile` with a current Expo-compatible Node runtime (validated with Node 24.14):

```sh
npm run typecheck
npm test
npm run build:web
npx expo export --platform ios --platform android --output-dir /tmp/fork-native-export
```

The frontend's five tests cover natural-language refinement composition, dietary-only searches, immutable defaults, approximate distances, and truthful fallback summaries. The existing backend suite passed all 93 tests against local Postgres and fake Redis. No repository linter is configured; formatting and `git diff --check` were also checked.

Browser validation used a production export connected to the actual local API through a temporary loopback-only preview server. It did not replace responses with mock restaurant data. Checked phone widths 320 and 390, tablet width 768, laptop width 1024, and desktop width 1440. Exercised city selection, real Google Places search, real price/rating refinement, loading/error/empty responses, photo gallery navigation, detail views, account gating, filter application/cancellation, Escape and focus restoration, and guest navigation. Verified fresh desktop and mobile loads without hydration errors, including font loading and responsive navigation. Exported both iOS and Android bundles; no physical device or simulator run was performed.

## Product and validation limits

- Supabase is not configured in the local frontend environment. Account screens and guest gating were inspected, and account/visit API tests pass; authenticated browser workflows still need a configured test account.
- The API does not expose verified dietary flags, hours, live availability, booking, saved lists, or similar-restaurant data on detail routes. Those features are not invented. Directions and the current Google Maps listing provide the existing external action.
- Detail metadata is passed through router parameters, as before. A bare place-ID deep link cannot retrieve full metadata because there is no restaurant-details endpoint.
- Device location requires the user's permission. Four explicitly labeled city centers provide a recovery option; they are geographic coordinates, not sample restaurants.
- The existing development dependency set emits an Expo patch-version advisory and a React Navigation / React Native Web `pointerEvents` deprecation warning. No application console errors were observed in the working production preview.

## Editorial asset

`mobile/assets/dining-editorial.jpg` is a 1200 px optimized JPEG generated with the built-in imagegen tool. It is generic food inspiration used only on the discovery welcome page, never as a restaurant photo.

Generation prompt: “Use case: photorealistic-natural. Asset type: editorial hero photograph for a premium restaurant discovery app. Create a beautiful realistic close-up overhead three-quarter dining-table photograph, landscape 3:2. A rustic ivory ceramic bowl of rigatoni with tomato sauce and basil, a small plate of burrata and heirloom tomatoes, an olive-green linen napkin and simple silver fork on a warm cream stone bistro table. Food centered and filling the frame, natural late afternoon sidelight, warm appetizing colors, quiet tasteful independent food magazine photography, visible food texture and subtle film grain. No people, no lettering, no logos, no watermark. This is generic food inspiration, not an actual restaurant.”
