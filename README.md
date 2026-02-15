# Imposter Game Box

Browser-based social party game built with Next.js and ready for Vercel.

## Current MVP

- Game-box home page (multi-game ready architecture)
- Game mode #1: `Fact or Fake`
- No-auth room flow (room code + optional password + display name)
- Host controls:
  - Discussion timer (1-5 minutes)
  - Number of imposters
  - Room fact language (`EN` / `RU`)
  - Start round / next round / back to lobby
- In-round controls:
  - End discussion early
  - Extend discussion (`+30s`, `+60s`)
- Full phase lifecycle:
  - Lobby -> Discussion -> Voting -> Results
- Unique facts per player in each round
- Bilingual UI with user language switch (`EN` / `RU`)
- Serverless realtime sync (long polling)
- Storage abstraction:
  - In-memory (local dev)
  - Upstash Redis (recommended for production)

## Facts Database

Facts now use two independent pools:

- `realFacts[]` for truth players
- `fakeFacts[]` for imposters

Current generated dataset:

- Runtime file: `data/facts/fact-or-fake.generated.json`
- Real facts: `10043`
- Fake facts: `5000`

Notes:

- Seed curated facts are still stored in `lib/games/fact-or-fake/facts.ts`.
- Wikidata imports are bilingual (`en` + `ru`).
- EPUB-derived facts currently mirror English text in RU fields until a dedicated translation pass is added.

## Fact Expansion Workflow

1) Extract from EPUB:

```bash
npm run facts:extract:epub -- "/Users/kmarkosyan/Downloads/The_Book_of_General_Ignorance.epub" data/facts/book-candidates.json
```

2) Build local dataset from EPUB:

```bash
npm run facts:build:epub -- data/facts/book-candidates.json data/facts/fact-or-fake.generated.json
```

3) Import bilingual Wikidata facts via SPARQL:

```bash
npm run facts:fetch:wikidata -- data/facts/fact-or-fake.generated.json
```

Full details: `scripts/facts/README.md`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

For stable multiplayer behavior in production, configure Redis:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without these, room state is in-memory and can be unreliable across multiple server instances.

## Room API

- `POST /api/rooms/create`
- `POST /api/rooms/join`
- `POST /api/rooms/[code]/action`
- `GET /api/rooms/[code]/sync?sessionId=...&since=...`

## Project Structure

- `app/` - pages, layout, API routes
- `components/` - client UI
- `lib/shared/` - shared types and i18n helpers
- `lib/games/` - game registry and fact data
- `lib/server/` - room engine and storage logic
- `scripts/facts/` - fact extraction and curation helpers
