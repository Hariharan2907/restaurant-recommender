# Fork app audit — September 4, 2026

The guest search experience works, but the app is not yet a reliable, fully operational personalized restaurant recommender. Several visible promises are not enforced by the backend.

## Scope and method

The working checkout was `main` at `8720282`, containing only README.md and .gitignore. The implemented app is on the locally available `phase-3-5-personalization` branch at `f296d58`. This audit tested an archive of that commit at `/tmp/fork-app-audit`; the checkout and implementation were not changed. No remote branch freshness or production deployment was checked.

Ran FastAPI on port 8000 and Expo web on port 8081, using an isolated pgvector/Postgres database on port 55432 and Redis database 14. Applied all three migrations. Existing installed dependencies were reused. The existing Postgres container could not start because its bind-mounted initialization file was absent on the scaffold checkout; the test container avoided that mount. Expo needed the available Node 24 executable because the project shell resolved an older Node version.

The original browser build stayed waiting for location with search disabled. To test the remaining UI independently of location permission, only the temporary copy of `mobile/lib/location.ts` was changed to return sample downtown Chicago coordinates (41.8839, -87.6324). Restaurant results, Google photos, and LLM responses remained live. This does not establish that device geolocation or native iOS/Android builds work.

## Test results

| Check | Result |
|---|---|
| Backend suite | **93 passed**, with real isolated Postgres and mocked external services |
| Mobile TypeScript | **Passed** on the original branch code |
| Migrations and `/health` | Passed; database and Redis both healthy |
| Live `/search` | HTTP 200, **4.41 seconds**, six results for `chipotle vegetarian` within a requested 1 km radius |
| Identical cached search | HTTP 200, **5.2 ms**, `cached: true` |
| Live `/recommendations` | HTTP 200, **10.03 seconds**, five picks for `cozy ramen`, mood `date night`; `personalized: false` |
| Invalid query/coordinates | HTTP 422 |
| Anonymous `/me` and `/discover` | HTTP 401 |
| Browser search → detail | Results, explanations, ratings, address, and restaurant photo displayed using sample coordinates |
| Discover / Log a visit | Both correctly navigated guests toward sign-in, but sign-in was disabled because auth was unconfigured |
| History / Profile | Both rendered their unconfigured-auth states |
| Additional defect reproductions | Three passed, confirming missing dietary enforcement, stale preferences in cache, and local-account recreation |

Timings are individual observations, not benchmark percentiles. Real Supabase login, email confirmation, live Voyage embeddings, Yelp data, the full background-worker pipeline, and native mobile builds were not validated. Database-backed tests cover visit CRUD, profile updates, taste ranking, dish extraction, and jobs with authentication/provider fixtures; that is not a substitute for those live integrations.

## Priority fixes

### 1. Enforce dietary requirements and ground explanations — high priority

`backend/app/services/filters.py:16` explicitly skips dietary filtering. The restaurant response has no verified dietary flags, while the UI describes dietary needs as hard requirements. Persisted `dietary_preferences` are also never consumed by the search, recommendation, or discovery pipelines.

Observed: `chipotle vegetarian` was parsed with `dietary: ["vegetarian"]`, but returned restaurants without verified dietary evidence. Explanations claimed vegetarian customization and menu options despite the explanation payload containing only names, cuisine, ratings, price, and addresses. Ramen explanations also inferred quietness and atmosphere from review counts.

Implement explicit dietary evidence and unknown states, enforce constraints consistently across modes, and prevent generated reasons from asserting unverified menu or ambiance facts. Convert this audit's reproduction into a regression test that expects unverified candidates to be handled according to the chosen product policy.

### 2. Preserve restaurant names and enforce distance — high priority

`backend/app/routers/search.py:54` and the recommendations equivalent replace the original query with the parsed cuisine. `chipotle vegetarian` became `mexican`; none of its six results was Chipotle.

`backend/app/services/places.py:89` uses a location bias and performs no final distance filter. Distances calculated from returned coordinates were approximately 252, 664, 1005, 1113, 1274, and 1475 metres: four exceeded the requested 1000 metres. `distance_m` is declared but never populated. Discovery uses a bounding box rather than an exact circular radius.

Keep restaurant/entity intent distinct from cuisine; preserve meaningful query terms, calculate distance, enforce the selected radius, and show distance in result cards. Populate cuisine from evidence rather than assigning the search text to every result.

### 3. Finish preference integration and cache invalidation — high priority

`backend/app/routers/me.py:47` saves preferences without incrementing the user cache version. Reproduction: fetch ramen recommendations, save ramen as a disliked cuisine, repeat the same query; the cached ramen result is still returned. The recommendation TTL is ten minutes.

Increment the existing user cache version when ranking/filter preferences change. Apply saved dietary preferences and cuisine likes; these currently appear only in profile storage/schema code. Search also ignores saved dislikes and always gets the schema's default 3 km radius because the mobile search request does not send a radius or load the profile default.

### 4. Make account deletion complete — high priority before releasing accounts

`backend/app/routers/me.py:71` deletes only the local row. The client then signs out; neither side deletes the Supabase identity. An isolated reproduction confirmed that `_resolve_user` recreates a fresh local account for the same identity after deletion.

Implement a server-side identity deletion workflow with explicit failure handling and session revocation, as well as local data deletion. Add an integration test that verifies the removed identity cannot simply log back in and recreate the account.

### 5. Recover from missing location — high priority for usability

`mobile/app/(tabs)/index.tsx` disables both query editing and submission until coordinates arrive. `mobile/lib/location.ts` has no application timeout, retry, or manual location fallback. The original browser build remained in this state.

Allow typing immediately. Offer city/address entry, a visible location status, retry, and a route to permission settings. Give empty results an actionable radius control; the existing message says to widen the search without providing that control on Search.

## What still needs implementing or operating

- **Account configuration:** Supabase settings are absent in both local backend and mobile configuration. Sign-in/sign-up screens and backend JWT verification exist, but accounts cannot work in this build. Configure and test email confirmation, session restoration, expiry, and visit logging end to end. Password reset UI is absent.
- **Personalization setup and onboarding:** Voyage is not configured, so new embeddings are skipped. Configure the provider and backfill; seed a new user's taste with favorite places or cuisine choices. Currently even one-star visits contribute positively to the taste vector; decide how negative feedback should affect ranking.
- **Reviews/dishes operation:** Worker and extraction code exist. `make dev` and the Compose stack do not start the worker. Search upserts do not enqueue enrichment; visits and manual backfill do. Add an explicit worker service and refresh scheduling. The current backfill only targets restaurants without dishes, so it does not periodically refresh restaurants that already have dishes.
- **Queue reliability:** The worker removes jobs using `BRPOP` before processing and does not retry or acknowledge them. Add bounded retries, in-flight tracking, failure visibility, and deduplication. Refresh affected user taste vectors after restaurant embeddings change in the background.
- **Restaurant details:** Fetch details by place ID. The current detail page relies on all restaurant metadata being passed through route parameters, so a bare deep link cannot reconstruct a useful detail view. Opening hours/open-now, actual distance, website, phone, and verified dietary data are not fetched.
- **Release infrastructure:** Deployment documentation exists; committed EAS build profiles and CI workflows are absent. Add reproducible dependency/bootstrap commands, a declared Node version, automated backend/type checks, and device smoke tests. Reconcile the scaffold main branch and the implemented feature branch; update PLAN.md's unchecked milestones to match verified status.

## Product and interface improvements

The typography, spacing, orange accent, and concise result cards provide a usable base. Focus first on trust and completing the decision flow:

1. Show photos, distance, open/closed status, and verified dietary evidence in results. Provide clear sort/radius controls and preserve filters visibly.
2. Reduce first-load waiting. Search took 4.4 seconds and recommendations 10 seconds versus the plan's 1.5–2 second cold target. Return candidates before explanations finish, show progressive loading, and allow cancellation. Prevent an old response from repopulating results after a mode switch or clear.
3. Add readable tab labels and accessibility labels; the current tab accessibility names are icon glyphs. Bound desktop content width and allow cards/metadata to wrap on smaller screens.
4. Replace developer configuration instructions and raw errors such as `API 502 on /search` with useful user-facing recovery states. Show success feedback after saving preferences and a loading state before declaring history empty.
5. Add saved places, editable/backdated visits, and return-to-intended-action after login as follow-on features. These are product recommendations, not existing implementation claims.

## Suggested delivery order

First fix dietary evidence, named-place search, radius enforcement, location recovery, and preference invalidation. Then configure and validate accounts, embeddings, and the worker, including complete deletion. Finally improve decision-making details, loading speed, onboarding, and mobile release coverage.

The audit reproduction tests and captured live JSON responses remain in `/tmp/fork-app-audit` for this local session. They assert the defective current behavior; they are diagnostic evidence, not acceptance tests for the desired behavior.
