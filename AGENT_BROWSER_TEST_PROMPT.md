# Browser testing prompt for Thrifty Flight Agent

Use this prompt with an agent that has **browser access** (e.g. can open http://localhost:5173 and interact with the page). The agent should verify the application and recent changes.

---

## Preconditions

- **App and API must be running:** From the repo root run `pnpm run dev` (web at http://localhost:5173, API at http://localhost:3000; API is proxied under `/api`).
- **Required env:** `OPENAI_API_KEY`, `SERP_API_KEY` (and DB/Redis if used). Without these, chat and flight search will fail; you can still check static UI.

---

## Your task

Open **http://localhost:5173** in the browser and run the test scenarios below. For each scenario, note **pass** or **fail** and any errors or unexpected behavior. Take screenshots if useful.

---

## Test scenarios

### 1. App loads and empty state

- Open http://localhost:5173/
- **Expect:** Page loads; empty state shows heading like "Where do you want to go?" and suggested query chips (e.g. "Flights from NYC to London next weekend").
- **Pass if:** Heading and at least one chip are visible; no console/UI errors.

### 2. One-way flight search

- Click a suggested chip (e.g. "Flights from NYC to London next weekend") or type "Flights from JFK to Miami on March 15" and send.
- Wait for the assistant reply and flight results.
- **Expect:** Assistant message with short summary; a "Flight options" section with flight cards (airline, times, duration, price); no "Select outbound" on cards (one-way).
- **Pass if:** At least one flight card appears; cards are readable; no "Select outbound" button on these cards.

### 3. Round-trip: "Select outbound" visible

- Start a **new chat** (e.g. "New conversation" or new chat button).
- Send: **"Round trip from JFK to Miami, March 1 to March 5"** (or similar with two dates).
- Wait for flight results.
- **Expect:** Section titled like "Outbound flights — X options. Select one to see return flights"; each flight card has a **"Select outbound"** button.
- **Pass if:** "Select outbound" is visible on outbound cards. If you see an error banner like "Return options aren't available for this option", note it (may happen when API doesn’t return a token).

### 4. Round-trip: Select outbound → return options

- From the same round-trip results as in scenario 3, click **"Select outbound"** on one card.
- Wait for loading (skeleton) then return options to appear.
- **Expect:** A "Return flights" section appears below with a list of return options; each return card has a **"Select return"** button; a "Change outbound" link/button is visible.
- **Pass if:** Return flights section appears; at least one "Select return" button is visible.

### 5. Round-trip: Select return flight

- From the return list in scenario 4, click **"Select return"** on one return card.
- **Expect:** Return list is replaced (or supplemented) by a confirmation like "Return flight selected" / "Return leg $X. Change outbound above to pick different return options."
- **Pass if:** Confirmation message appears after selecting a return.

### 6. Other flights (accordion)

- In any response that has flight results, if there are both "best" and "other" options, look for a button like **"View X more options"** below the best options.
- Click it.
- **Expect:** Additional flight cards expand below.
- **Pass if:** Extra options appear; a "Hide extra options" (or similar) control is available.

### 7. Price history (multi-route)

- After at least one flight search, check the chip bar above the input for a **price history** chip (e.g. "JFK → MIA price history" or similar).
- Click it.
- **Expect:** A price history panel/modal opens showing a route and chart (or "no data" / form).
- Close the panel. Scroll to an **assistant message that has flight results** and look for a link like **"Price history for this route"** below the flight cards.
- Click that link.
- **Expect:** The price history panel opens again, for that message’s route.
- **Pass if:** Header chip opens the panel; per-message "Price history for this route" also opens the panel (multi-route behavior).

### 8. No errors in console

- While doing the above (or after), open the browser dev tools (F12) → Console.
- **Expect:** No red errors; warnings are acceptable.
- **Pass if:** No uncaught errors in console.

---

## Summary to report

Provide a short report:

- **Scenarios passed:** e.g. 6/8.
- **Scenarios failed:** Which ones and what happened (e.g. "Select outbound not visible", "Return options never loaded").
- **Notes:** Any broken UI, wrong copy, or behavior that doesn’t match the expectations above.
- **Screenshots:** Paths or descriptions if you saved any.

---

## Reference: recent changes covered by these tests

- **Round-trip = outbound first:** Round-trip searches show outbound options with "Select outbound"; return options load after selection via `/api/flight-search/return-options`.
- **Select return:** Return cards have "Select return"; selecting one shows a confirmation.
- **Select outbound always shown:** Button appears on all outbound cards when in round-trip mode (even if some options later fail to load return options).
- **Other flights:** Best flights first, then "View X more options" to expand other options.
- **Multi-route price history:** Each message with flight results can have its own "Price history for this route"; header chip uses latest route.
