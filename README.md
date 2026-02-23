# Thrifty Flight Agent

An AI-powered flight search agent built with NestJS, React, LangChain, and Google Flights via SerpAPI. The AI interprets natural language queries, calls a real-time flight search tool, and renders results as rich interactive flight cards with price history charts.

---

## Architecture

```
thrifty-flight-agent/
├── apps/
│   ├── api/          NestJS backend – AI agent, SerpAPI, caching, persistence
│   └── web/          React + Vite frontend – chat UI, flight cards, charts
└── packages/
    └── types/        Shared TypeScript interfaces (consumed by both apps)
```

The frontend uses **React with Vite** (not Next.js) for fast dev feedback and simple deployment.

**Key choices:**

| Concern          | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| AI orchestration | LangChain (`createToolCallingAgent`) + GPT-4o           |
| Flight data      | SerpAPI Google Flights engine                           |
| Caching          | Redis (falls back to in-memory if Redis is unavailable) |
| Database         | PostgreSQL via TypeORM (SQLite for tests)               |
| Charts           | Recharts (`AreaChart`)                                  |
| Monorepo         | Turborepo + pnpm workspaces                             |

---

## Quick start (local dev)

### Prerequisites

- Node.js ≥ 18
- pnpm 9 (`corepack enable`)
- Docker Desktop (for Postgres + Redis)

### 1. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 2. Configure environment

```bash
# apps/api/.env already contains defaults – add your real keys:
OPENAI_API_KEY=sk-...
SERP_API_KEY=<your-serpapi-key>
```

Get a free SerpAPI key at <https://serpapi.com>.

### 3. Install & run

```bash
pnpm install
pnpm dev          # starts both api (port 3000) and web (port 5173)
```

Open <http://localhost:5173> and start searching.

> **No Redis?** The API falls back to an in-memory cache automatically – you'll see a warning in the logs but the app works fine.

---

## Running with Docker (full stack)

```bash
# Build and run everything – postgres, redis, api, web
OPENAI_API_KEY=sk-... SERP_API_KEY=... docker compose up --build
```

The web UI is served at <http://localhost:80>.

---

## API reference

### `POST /chat`

Runs the LangChain agent against the conversation history. The agent decides whether to call the `search_flights` tool based on the user's message.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Find flights from JFK to CDG next Friday" }
  ]
}
```

**Response**

```json
{
  "message": "Here are the best options I found…",
  "flightResults": {
    "best_flights": [ ... ],
    "other_flights": [ ... ],
    "price_insights": { "lowest_price": 485, "price_level": "low" }
  }
}
```

### `GET /price-history?departure=JFK&arrival=CDG`

Returns all saved search records for a route, ordered newest-first, with the lowest price extracted per record. Used to power the price history chart.

### `GET /flight-search/search`

Direct flight search endpoint (bypasses the AI). Accepts the same params as SerpAPI: `departure_id`, `arrival_id`, `outbound_date`, `return_date`, `type`.

---

## Testing

```bash
# Unit tests (FlightSearchService + others)
pnpm --filter api test

# E2E tests (ChatController – no real API keys needed)
pnpm --filter api test:e2e
```

Tests use an in-memory SQLite database and mock the `ChatService` so they run in CI without any external dependencies.

---

## How the AI tool calling works

1. The user sends a message via `POST /chat`.
2. `ChatService` creates a LangChain `AgentExecutor` with a single `search_flights` tool and the full conversation history.
3. GPT-4o decides whether to call the tool. If it does, it emits a structured tool call with IATA codes and dates.
4. `FlightSearchService` checks the Redis cache, calls SerpAPI if needed, and caches the result for 1 hour.
5. `PriceHistoryService` saves a record of the search (route + lowest price) to Postgres.
6. The agent synthesises the raw SerpAPI JSON into a human-readable summary.
7. Both the summary **and** the raw `flightResults` are returned to the frontend.
8. The frontend renders the structured data as `FlightOptionCard` components — airline logo, segment timeline, layover pills, CO₂ badge — rather than plain text.

---

## Folder structure highlights

```
apps/api/src/
  modules/
    chat/              POST /chat controller + LangChain agent
    flight-search/     SerpAPI wrapper + Redis caching
    price-history/     TypeORM entity + price history controller
  cache.module.ts      Redis with in-memory fallback

apps/web/src/
  components/
    FlightOptionCard   Rich flight card with segments, layovers, airline logo
    FlightResults      Card grid + price insights header
    PriceHistoryPanel  Recharts AreaChart + stats row
    SkeletonCard       Shimmer skeleton loader
  types/
    chat.ts            Re-exports from @repo/types
    price-history.ts   Re-exports from @repo/types

packages/types/src/
  index.ts             Canonical shared interfaces
```
