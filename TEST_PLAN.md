# TEST_PLAN.md — Thrifty Traveler QA

Manual test scenarios for QA engineers. Each scenario lists preconditions, steps, and expected outcomes.

---

## Environment Setup

| Item              | Value                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| API base          | `http://localhost:3000`                                                           |
| Web app           | `http://localhost:5173`                                                           |
| Required env vars | `OPENAI_API_KEY`, `SERP_API_KEY`, `DATABASE_*`, `REDIS_URL`                       |
| Database          | PostgreSQL (or `better-sqlite3` for local dev via `DATABASE_TYPE=better-sqlite3`) |

Run stack: `pnpm dev` from repo root.

---

## 1. Chat Interactions

### TC-01 — Basic one-way flight search

**Preconditions:** App loaded, empty chat.  
**Steps:**

1. Type "Flights from JFK to CDG on March 15" → press Enter.
2. Wait for response.

**Expected:**

- Assistant replies with a 1–2 sentence summary (route, count, price range).
- Flight cards appear below the assistant bubble showing airline logo, departure/arrival times, duration, stop count, price.
- No duplicate flight data listed in the assistant's text.

---

### TC-02 — Round-trip flight search

**Steps:**

1. Type "Round trip NYC to London, depart April 5, return April 12".

**Expected:**

- Cards show "Round trip" label on each card.
- Price reflects round-trip total, not per-leg price.

---

### TC-03 — Empty state → suggested queries

**Preconditions:** Fresh session (no messages).  
**Steps:**

1. Observe the input chip bar above the input field.
2. Click "Flights from NYC to London next weekend".

**Expected:**

- Chip text is sent as the user message automatically.
- Search executes as in TC-01.

---

### TC-04 — Health check endpoint

**Steps:**

1. `GET /api/health-check`

**Expected:** HTTP 200, body `OK`.

---

## 2. Tool Calling Accuracy

### TC-05 — IATA code resolution

**Steps:**

1. Type "Flights from New York to Paris next Friday".

**Expected:**

- Agent resolves "New York" → JFK (or EWR/LGA on retry) and "Paris" → CDG (or ORY).
- Cards display correct airport codes.

---

### TC-06 — Date resolution ("next weekend")

**Steps:**

1. Determine current date.
2. Type "Flights from LAX to SFO next weekend".

**Expected:**

- Outbound date resolves to the Saturday that is 7–14 days away (not within 6 days).

---

### TC-07 — Retry on empty results

**Preconditions:** If SerpAPI returns empty for a near-term date.  
**Steps:**

1. Type "Flights from JFK to LHR tomorrow".

**Expected:**

- Agent does NOT immediately say "no flights found".
- Agent retries with a date ≥ 7 days out and/or alternate airports (EWR, LGA).
- After up to 2 retries, results appear OR agent apologises with "results temporarily unavailable".

---

### TC-08 — SerpAPI response cached (Redis)

**Steps:**

1. Search "JFK to CDG on April 10" — note response time (first call ~2–4 s).
2. Repeat identical search.

**Expected:**

- Second call returns noticeably faster (sub-200 ms) due to Redis cache hit.
- Server logs show `searchFlight cache hit`.

---

## 3. Follow-up / Refinement Questions

### TC-09 — Filter to nonstop

**Preconditions:** TC-01 complete (results visible).  
**Steps:**

1. Type "Only show nonstop options".

**Expected:**

- Agent calls `search_flights` again (same route/date).
- Response text mentions nonstop / direct flights.
- Cards rendered are for nonstop itineraries (stops column shows "Nonstop").

---

### TC-10 — Change departure date

**Preconditions:** TC-01 complete.  
**Steps:**

1. Type "What about March 20 instead?"

**Expected:**

- Agent reruns search with `outbound_date: 2025-03-20`.
- New cards replace old ones in the new assistant bubble.

---

### TC-11 — Multi-turn context preserved

**Steps:**

1. "Flights from BOS to MIA on April 1".
2. "What's the cheapest option?" (no airports mentioned).
3. "And are there any nonstop?"

**Expected:**

- Each follow-up correctly inherits BOS→MIA context.
- Agent doesn't re-ask for origin/destination.

---

## 4. Price History Charts

### TC-12 — Price history chip appears after search

**Preconditions:** TC-01 complete.  
**Steps:**

1. Observe the chip bar above the input field.

**Expected:**

- "📈 JFK → CDG price history" chip appears.

---

### TC-13 — Price history panel opens and loads

**Steps:**

1. Click the "📈 JFK → CDG price history" chip.

**Expected:**

- Modal panel opens with header "JFK → CDG".
- Stats row shows Lowest / Average / Highest / Dates.
- Area chart renders with price data points.
- Hovering a data point shows a tooltip with date and price.

---

### TC-14 — Price history with no data

**Steps:**

1. Open the price history form (no prior search route).
2. Enter departure "XXX" and arrival "YYY" (unknown route).
3. Click "Load history".

**Expected:**

- Panel shows "No price history for this route yet."

---

### TC-15 — Price history across multiple searches

**Steps:**

1. Search "JFK to CDG on April 5".
2. Search "JFK to CDG on April 12".
3. Open price history for JFK → CDG.

**Expected:**

- Chart shows at least 2 data points (one per departure date).
- Records list shows both searches.

---

## 5. Price Alerts

### TC-16 — Set Price Alert modal opens

**Preconditions:** TC-01 complete with flight cards visible.  
**Steps:**

1. Expand any flight card (click the row).
2. Click the "🔔 Set Alert" button in the expanded footer.

**Expected:**

- Modal appears titled "🔔 Set Price Alert".
- Sub-title shows the correct route and departure date.
- Target price field is pre-filled with ~10% below the current price.

---

### TC-17 — Create a price alert (happy path)

**Steps:**

1. Open modal (TC-16).
2. Enter email `qa@example.com`.
3. Set target price to any value ≤ current price.
4. Click "Set Alert".

**Expected:**

- Button shows "Saving…" while request is in-flight.
- Success state renders: "Alert set! We'll notify qa@example.com when the price drops to $X or below."
- Clicking "Done" closes the modal.

---

### TC-18 — Price alert stored in database

**Steps:**

1. Complete TC-17.
2. `GET /api/price-alerts?email=qa@example.com`

**Expected:**

- HTTP 200 with JSON array containing at least one object with:
  - `departureId`, `arrivalId`, `outboundDate` matching the flight.
  - `status: "active"`.
  - `targetPrice` matching the submitted value.
  - `triggeredAt: null`.

---

### TC-19 — Price alert validation (missing email)

**Steps:**

1. Open modal (TC-16).
2. Leave email blank, enter target price.
3. Click "Set Alert" (button should be disabled).

**Expected:**

- "Set Alert" button is disabled (cannot submit).

---

### TC-20 — Background cron job — trigger simulation

**Preconditions:** One active alert exists with `targetPrice` ≥ current market price for the route.  
**Steps:**

1. Insert an alert via `POST /api/price-alerts` with `targetPrice` = 9999 (above any real price).
2. Wait up to 10 minutes (cron interval) OR manually invoke `GET /api/price-alerts` to confirm alert is still active.
3. Check API logs.

**Expected:**

- Logs contain a line like:
  ```
  [ALERT TRIGGERED] To: test@example.com | JFK→CDG on 2026-04-10 is now $285 (target $9999). [SIMULATED EMAIL SENT]
  ```
- `GET /api/price-alerts?email=test@example.com` returns `status: "triggered"` and a non-null `triggeredAt`.

---

### TC-21 — Alert expires for past departure date

**Steps:**

1. Insert an alert via `POST /api/price-alerts` with `outboundDate` = yesterday's date.
2. Wait for the next cron run (≤ 10 minutes).

**Expected:**

- Alert status changes to `"expired"`.
- No SerpAPI call is made for this alert.
- Log shows "Alert {id} expired (date … is past)".

---

## 6. Sidebar / Session Management

### TC-22 — New chat session

**Steps:**

1. Send a message in session 1.
2. Click "+ New chat" in the sidebar.

**Expected:**

- A new empty session opens.
- Previous session remains listed in the sidebar.
- Switching back to session 1 restores its messages.

---

### TC-23 — Delete session

**Steps:**

1. Hover over a session in the sidebar.
2. Click the trash (×) icon.

**Expected:**

- Session is removed from the list.
- If it was the active session, a new empty session is created.

---

### TC-24 — Session persistence across page refresh

**Steps:**

1. Send a message and receive a response.
2. Hard-refresh the browser.

**Expected:**

- Session is restored from localStorage with all messages intact.

---

## 7. Error Handling

### TC-25 — Invalid API key

**Steps:**

1. Set `OPENAI_API_KEY=invalid` in `.env`.
2. Send any chat message.

**Expected:**

- Error banner appears: descriptive error message (not a blank page or unhandled crash).

---

### TC-26 — Network error / API offline

**Steps:**

1. Stop the API server.
2. Send a chat message from the frontend.

**Expected:**

- Error banner shows a meaningful message (e.g. "Failed to fetch").
- Dismiss button (×) clears the banner.

---

## 8. Regression Checklist

After any code change, quickly verify:

- [ ] TC-01 (basic search) passes
- [ ] TC-08 (caching) passes
- [ ] TC-13 (price history chart) renders
- [ ] TC-17 (price alert creation) succeeds
- [ ] TC-22 (session management) works
- [ ] `GET /api/health-check` returns 200
