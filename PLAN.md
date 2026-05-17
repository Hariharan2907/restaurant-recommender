# Restaurant Recommendation App — PLAN.md

## Product Overview

A mobile-first app that gives personalized restaurant recommendations based on user history and natural-language queries.

**Core user flow:**
1. User enters a natural-language query (e.g. "I'm hungry, feeling healthy but want something tasty, 4+ stars, Indian")
2. App parses query into structured filters (cuisine, rating, vibe, dietary, price)
3. App pulls candidate restaurants, filtered by history and preferences
4. LLM re-ranks results using past visits, popular dishes, and current mood
5. Returns top 3–5 recommendations with one-line explanations

## Key Features

- **Natural-language search** with mood + constraints
- **Personalized recommendations** based on visit history
- **Discover mode** for new/similar restaurants using vector similarity
- **Popular dishes** extracted from Google/Yelp reviews via LLM
- **Dietary filters** (vegetarian, vegan, gluten-free) as hard filters
- **Visit logging** so the taste profile improves over time

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React Native + Expo (iOS + Android) |
| Backend | FastAPI (Python 3.11+) |
| Database | Postgres with pgvector |
| Cache/Queue | Redis (Upstash for managed) |
| LLM | Anthropic Claude API (Haiku for parsing, Sonnet for ranking) |
| Places data | Google Places API + Yelp Fusion API |
| Auth | Supabase Auth |
| Hosting | Railway (backend), Supabase (DB), Expo EAS (mobile) |

## Architecture

### Request flow (recommendations endpoint)
1. Mobile app → `POST /recommendations` with query + filters
2. Check Redis for cached identical query
3. **Parse call**: Claude Haiku parses natural-language → structured filters (~500ms)
4. **Hard filters** applied (rating, dietary, cuisine, distance)
5. **Vector search** in Postgres: candidates ranked by similarity to user's taste profile (~50ms)
6. Google Places fills live data (hours, distance) — cached aggressively (~200ms)
7. **Rank call**: Claude Sonnet re-ranks top 20 candidates with history + popular dishes + mood (~1s)
8. Response cached in Redis for 10 minutes

**Total latency target:** ~1.5–2s cold, <100ms warm

### Background jobs (queue-based, not in request path)
- Fetch and cache reviews from Google + Yelp
- Extract popular dishes from reviews using Claude
- Generate restaurant embeddings for similarity search
- Refresh user taste profile vector on new visits
- Nightly cron to refresh popular dishes for recently-viewed restaurants

## Database Schema (Postgres + pgvector)

```sql
users
  id uuid PK
  email text
  created_at timestamptz
  taste_profile_vector vector(1536)

restaurants
  id uuid PK
  google_place_id text unique
  yelp_id text
  name text
  cuisine text
  price_tier int  -- 1-4
  lat float
  lng float
  rating float
  dietary_flags jsonb  -- {vegetarian: true, vegan: false, gluten_free: true}
  vibe_tags text[]     -- ['cozy', 'date-night', 'healthy']
  embedding vector(1536)

reviews_raw
  id uuid PK
  restaurant_id uuid FK
  source text  -- 'google' | 'yelp'
  text text
  rating float
  review_date timestamptz

popular_dishes
  id uuid PK
  restaurant_id uuid FK
  dish_name text
  mention_count int
  sentiment float  -- -1 to 1
  sample_quote text

visits
  id uuid PK
  user_id uuid FK
  restaurant_id uuid FK
  mood text
  dishes_ordered text[]
  my_rating int  -- 1-5
  notes text
  visited_at timestamptz
```

## LLM Prompts

### Parse prompt (Haiku)
Input: natural-language query
Output: JSON with `cuisine`, `min_rating`, `vibe_tags`, `dietary`, `price_max`, `intent`

### Rank prompt (Sonnet)
Input: parsed query + top 20 candidates + user's last 20 visits + popular dishes per candidate
Output: top 5 ranked with one-sentence reason per pick (referencing past visits where relevant)

### Dish extraction prompt (Haiku, batch)
Input: 20–50 reviews for a restaurant
Output: JSON array of dishes with mention count, sentiment, sample quote

## Build Order

### Phase 1 — MVP scaffolding
- [ ] Monorepo with `/backend` and `/mobile`
- [ ] FastAPI app + Postgres + Alembic migrations
- [ ] Expo app with Search, History, Profile tabs
- [ ] Docker Compose for local Postgres + Redis

### Phase 2 — Core search
- [ ] Google Places integration (with caching)
- [ ] Claude parse endpoint
- [ ] Hardcoded filter search working end-to-end

### Phase 3 — Personalization
- [ ] Visit logging UI + endpoint
- [ ] Embeddings for restaurants
- [ ] User taste profile vector
- [ ] Vector similarity search
- [ ] Claude rank endpoint using history

### Phase 4 — Reviews + dishes
- [ ] Background job: fetch reviews
- [ ] Claude dish extraction pipeline
- [ ] Display popular dishes in UI

### Phase 5 — Polish + deploy
- [ ] Dietary filter UI
- [ ] Discover mode toggle
- [ ] Mood preset chips
- [ ] Deploy backend to Railway
- [ ] Submit to App Store + Play Store via EAS

## Production Considerations

- **Rate-limit per user** on backend (not just globally)
- **Set hard daily caps** in Google Cloud Console to prevent runaway bills
- **Cache aggressively**: Places data 7d, reviews 30d, taste profile invalidated on new visit
- **All third-party API calls go through backend** — never ship keys in the mobile app
- **Connection pooling** (PgBouncer) for Postgres
- **Sentry** for errors, **PostHog** for product analytics
- **Log every Claude call** with input/output/latency for debugging recommendations
- **Attribution required** for Yelp content — read App Store guidelines before submitting

## Cost Estimate (100 daily users)

| Item | Monthly |
|------|---------|
| Hosting (Railway) | $20 |
| Postgres (Supabase) | $10–25 |
| Redis (Upstash) | Free tier |
| Claude API | $30–60 |
| Google Places | $50–200 (cache hard) |
| Yelp Fusion | Free tier |

## Open Questions

- Coverage area for launch (single city vs national)?
- Onboarding flow — do we ask for 5 favorite restaurants to seed the taste profile?
- How to handle the cold-start problem for brand-new users with no history?