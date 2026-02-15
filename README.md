# Imposter Game Box

Browser-based social party game built with Next.js and ready for Vercel deployment.

## Implemented MVP

- Game box home page (future-proof for multiple game modes)
- Game mode #1: `Fact or Fake`
- No-auth room flow with display names
- Room create/join via code + optional password
- Host controls:
  - Discussion timer (1-5 minutes)
  - Number of imposters
  - Start game / next round / back to lobby
- Round lifecycle:
  - Lobby
  - Discussion (private cards)
  - Voting
  - Results reveal (imposters, votes, cards)
- Live room sync via long polling (`/sync`) compatible with serverless environments
- Optional Redis-backed room persistence (Upstash) for multi-instance deployments

## Tech Stack

- Next.js (App Router, TypeScript)
- React
- Serverless API routes
- Store abstraction:
  - In-memory store (default for local dev)
  - Upstash Redis store (enabled via env vars)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

This app works without a database (in-memory) for quick tests, but production should use Redis storage.

### Recommended env vars

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

When both are present, the app switches from in-memory room storage to Redis storage.

## Room API Surface

- `POST /api/rooms/create`
- `POST /api/rooms/join`
- `POST /api/rooms/[code]/action`
- `GET /api/rooms/[code]/sync?sessionId=...&since=...`

## Project Structure

- `app/` - pages, layouts, API handlers
- `components/` - client UI (game entry + room experience)
- `lib/shared/` - shared game/room types
- `lib/games/` - game registry + fact dataset
- `lib/server/` - game engine, store, helpers, error handling

## Notes

- Minimum player count is 3.
- Scores are tracked per room session.
- Joining is limited to lobby phase for fairness.
- Long polling provides near real-time updates and avoids websocket-only hosting constraints.
