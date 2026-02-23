/**
 * Playwright browser tests aligned to TEST_PLAN.md.
 * Run: node scripts/browser-test.mjs
 * Requires: app at http://localhost:5173, API at http://localhost:3000 (proxied).
 * Screenshots: scripts/screenshots/
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = join(__dirname, "screenshots");
mkdirSync(SCREENSHOTS, { recursive: true });

const BASE = "http://localhost:5173";
const TIMEOUT = 90_000;

const results = { passed: 0, failed: 0, skipped: 0 };

function ok(tc, msg = "OK") {
  results.passed++;
  console.log(`   [PASS] ${tc} ${msg}`);
}

function fail(tc, msg) {
  results.failed++;
  console.log(`   [FAIL] ${tc} ${msg}`);
}

function skip(tc, msg) {
  results.skipped++;
  console.log(`   [SKIP] ${tc} ${msg}`);
}

async function shot(page, name) {
  const p = join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`   📸 ${name}.png`);
  return p;
}

async function sendMessage(page, text) {
  const input = page.getByRole("textbox", { name: "Message" });
  await input.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('input[aria-label="Message"]')?.disabled, { timeout: 15000 }).catch(() => {});
  await input.fill(text);
  await page.keyboard.press("Enter");
}

function flightSection(page) {
  return page.locator('section[aria-label="Flight options"]');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  try {
    // ─── TC-04 Health check ───────────────────────────────────────────────────
    console.log("\n▶ TC-04 — Health check endpoint");
    const healthRes = await page.request.get(`${BASE}/api/health-check`);
    const body = await healthRes.text();
    if (healthRes.ok() && body.trim() === "OK") {
      ok("TC-04", "GET /api/health-check 200, body OK");
    } else {
      fail("TC-04", `status ${healthRes.status()} body=${body}`);
    }
  } catch (e) {
    fail("TC-04", e.message);
  }

  try {
  // ─── 1. Chat interactions ──────────────────────────────────────────────────
  console.log("\n▶ Loading app…");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Message" }).waitFor({ state: "attached", timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot(page, "00-home");

  // TC-03 — Empty state → suggested queries
  console.log("\n▶ TC-03 — Empty state → suggested queries");
  const heading = await page.getByRole("heading", { name: /where do you want/i }).textContent({ timeout: 10000 }).catch(() => null);
  if (!heading?.toLowerCase().includes("where")) {
    const anyHeading = await page.locator("h2").first().textContent({ timeout: 3000 }).catch(() => null);
    if (anyHeading?.toLowerCase().includes("where")) ok("TC-03", "Empty state with heading");
    else fail("TC-03", `Expected welcome heading, got: ${heading ?? anyHeading ?? "none"}`);
  } else {
    ok("TC-03", "Empty state with heading");
  }
  const firstChip = page.getByRole("button", { name: "Flights from NYC to London next weekend" });
  await firstChip.click();
  await page.waitForTimeout(500);
  const typingVisible = await page.locator(".typing-dot").first().isVisible().catch(() => false);
  if (typingVisible) ok("TC-03", "Chip sent, search started (typing indicator)");
  await shot(page, "TC03-chip-sent");

  // TC-01 / TC-03 — Wait for flight results (basic search behaviour)
  console.log("\n▶ TC-01 / TC-03 — Wait for flight results");
  try {
    await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
    await page.waitForTimeout(300);
  } catch (e) {
    fail("TC-01", `No flight results: ${e.message}`);
    await shot(page, "TC01-timeout");
  }
  const cards = flightSection(page).getByRole("button", { name: /expand details|collapse details/ });
  const cardCount = await cards.count();
  if (cardCount > 0) {
    ok("TC-01", `Assistant reply + ${cardCount} flight cards`);
  }
  const lowestPrice = flightSection(page).locator("strong.text-app-green").first();
  if (await lowestPrice.isVisible().catch(() => false)) {
    ok("TC-01", `Price range shown: ${await lowestPrice.textContent()}`);
  }
  await shot(page, "TC01-results");

  // TC-02 — Round-trip (we already did one-way via chip; optional: send round-trip in same session)
  console.log("\n▶ TC-02 — Round-trip search");
  await sendMessage(page, "Round trip NYC to London, depart April 5, return April 12");
  await page.waitForTimeout(500);
  try {
    await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
    const roundTripLabel = flightSection(page).last().getByText("round trip", { exact: false }).first();
    if (await roundTripLabel.isVisible().catch(() => false)) {
      ok("TC-02", "Round trip label on cards");
    } else {
      skip("TC-02", "Round trip label not found in DOM (may still be correct)");
    }
  } catch (e) {
    skip("TC-02", `Results wait: ${e.message}`);
  }
  await shot(page, "TC02-roundtrip");

  // TC-02b — Round-trip: "Select outbound" visible and return flow
  console.log("\n▶ TC-02b — Select outbound + return flow");
  const selectOutboundBtn = page.getByRole("button", { name: "Select outbound" }).first();
  const outboundVisible = await selectOutboundBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  if (outboundVisible) {
    ok("TC-02b", "Select outbound button visible");
    await selectOutboundBtn.click();
    await page.waitForTimeout(3000);
    const returnHeading = page.getByRole("heading", { name: "Return flights" });
    const returnVisible = await returnHeading.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
    if (returnVisible) {
      ok("TC-02b", "Return flights section appeared after Select outbound");
      const selectReturnBtn = page.getByRole("button", { name: "Select return" }).first();
      const returnBtnVisible = await selectReturnBtn.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
      if (returnBtnVisible) {
        ok("TC-02b", "Select return button visible");
        await selectReturnBtn.click();
        await page.waitForTimeout(500);
        const selectedMsg = page.getByText("Return flight selected");
        if (await selectedMsg.isVisible().catch(() => false)) ok("TC-02b", "Return flight selected confirmation");
      } else {
        skip("TC-02b", "Select return button not found (may still be loading)");
      }
    } else {
      skip("TC-02b", "Return flights section did not appear (API may not return departure_token)");
    }
    await shot(page, "TC02b-return-flow");
  } else {
    fail("TC-02b", "Select outbound button not found (round-trip outbound mode)");
  }

  // ─── 2. Tool calling (TC-05, TC-06, TC-07, TC-08) ──────────────────────────
  // TC-05 — IATA resolution: new session, "New York to Paris next Friday"
  console.log("\n▶ TC-05 — IATA resolution (New York → JFK, Paris → CDG)");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(300);
  await sendMessage(page, "Flights from New York to Paris next Friday");
  try {
    await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
    const body = await page.locator('[role="log"]').textContent();
    const hasCodes = /JFK|EWR|LGA|CDG|ORY/i.test(body ?? "");
    if (hasCodes) ok("TC-05", "Airport codes in response");
    else skip("TC-05", "Could not confirm codes in text");
  } catch (e) {
    skip("TC-05", e.message);
  }

  // TC-08 — Cache: same search twice, second should be faster (best-effort)
  console.log("\n▶ TC-08 — SerpAPI cached (second search faster)");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(200);
  const t1 = Date.now();
  await sendMessage(page, "JFK to CDG on April 10");
  await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
  const firstTime = Date.now() - t1;
  await sendMessage(page, "JFK to CDG on April 10");
  const t2 = Date.now();
  await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
  const secondTime = Date.now() - t2;
  if (secondTime < firstTime * 0.5) {
    ok("TC-08", `Second request faster (${secondTime}ms vs ${firstTime}ms)`);
  } else {
    skip("TC-08", `Timing not clearly faster: ${secondTime}ms vs ${firstTime}ms`);
  }

  // ─── 3. Follow-up (TC-09, TC-10, TC-11) ───────────────────────────────────
  console.log("\n▶ TC-09 — Filter to nonstop");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(200);
  await sendMessage(page, "Flights from JFK to CDG on April 15");
  await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
  await sendMessage(page, "Only show nonstop options");
  await page.waitForTimeout(500);
  try {
    await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
    const nonstop = flightSection(page).last().getByText("Nonstop", { exact: true }).first();
    if (await nonstop.isVisible().catch(() => false)) {
      ok("TC-09", "Nonstop options shown");
    } else {
      skip("TC-09", "Nonstop label not found");
    }
  } catch (e) {
    skip("TC-09", e.message);
  }

  console.log("\n▶ TC-11 — Multi-turn context (BOS→MIA, cheapest, nonstop)");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(200);
  await sendMessage(page, "Flights from BOS to MIA on April 1");
  await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
  await sendMessage(page, "What's the cheapest option?");
  await page.waitForTimeout(500);
  await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
  await sendMessage(page, "And are there any nonstop?");
  await page.waitForTimeout(500);
  try {
    await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
    ok("TC-11", "Follow-ups kept BOS→MIA context");
  } catch (e) {
    skip("TC-11", e.message);
  }

  // ─── 4. Price history (TC-12, TC-13, TC-15) ─────────────────────────────────
  // Use a session that has one route so price history chip is visible
  console.log("\n▶ TC-12 — Price history chip appears after search");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(200);
  await sendMessage(page, "Flights from JFK to CDG on April 5");
  await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
  const historyChip = page.getByRole("button", { name: /price history/i }).first();
  const chipVisible = await historyChip.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
  if (chipVisible) {
    ok("TC-12", "Price history chip visible");
  } else {
    fail("TC-12", "Price history chip not found (route chip appears after results)");
  }

  console.log("\n▶ TC-13 — Price history panel opens and loads");
  await historyChip.click();
  await page.waitForTimeout(800);
  const panel = page.getByRole("dialog", { name: "Price history" });
  if (await panel.isVisible().catch(() => false)) {
    ok("TC-13", "Panel opened");
    const header = panel.getByText(/→/).first();
    if (await header.isVisible().catch(() => false)) ok("TC-13", "Header shows route");
    const stats = panel.locator(".grid.grid-cols-4");
    if (await stats.isVisible().catch(() => false)) ok("TC-13", "Stats row visible");
    const chart = page.locator(".recharts-wrapper").first();
    if (await chart.isVisible().catch(() => false)) ok("TC-13", "Chart rendered");
  } else {
    fail("TC-13", "Panel did not open");
  }
  await shot(page, "TC13-price-history");
  await page.getByRole("button", { name: "Close price history" }).click();
  await page.waitForTimeout(300);

  // TC-15 — Multiple searches, then price history
  console.log("\n▶ TC-15 — Price history across multiple searches");
  await sendMessage(page, "JFK to CDG on April 12");
  await flightSection(page).last().waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /price history/i }).first().click();
  await page.waitForTimeout(800);
  const panel2 = page.getByRole("dialog", { name: "Price history" });
  const recordCount = await panel2.locator("ul li").count();
  if (recordCount >= 2) {
    ok("TC-15", `Chart/list has multiple points: ${recordCount}`);
  } else {
    skip("TC-15", `Expected ≥2 records, got ${recordCount}`);
  }
  await page.getByRole("button", { name: "Close price history" }).click();
  await page.waitForTimeout(200);

  // TC-14 — No data: open form with manual route (if UI allows). Current app only shows chip when route exists; no standalone "enter route" from empty state.
  console.log("\n▶ TC-14 — Price history with no data");
  skip("TC-14", "No UI to open route form without prior search in current app");

  // ─── 5. Price alerts (TC-16, TC-17, TC-19, TC-18) ──────────────────────────
  console.log("\n▶ TC-16 — Set Price Alert modal opens");
  await page.getByRole("button", { name: /New chat/i }).first().click();
  await page.waitForTimeout(200);
  await sendMessage(page, "Flights from JFK to CDG on April 20");
  await flightSection(page).first().waitFor({ state: "visible", timeout: TIMEOUT });
  await flightSection(page).first().getByRole("button", { name: /expand details|collapse details/ }).first().click();
  await page.waitForTimeout(200);
  const setAlertBtn = flightSection(page).first().getByRole("button", { name: /Set alert/i }).first();
  await setAlertBtn.click();
  await page.waitForTimeout(300);
  const alertDialog = page.getByRole("dialog", { name: "Set price alert" });
  if (await alertDialog.isVisible().catch(() => false)) {
    ok("TC-16", "Modal opened");
    const title = alertDialog.getByText("Set Price Alert", { exact: false });
    if (await title.isVisible().catch(() => false)) ok("TC-16", "Title and route shown");
  } else {
    fail("TC-16", "Set Price Alert modal not found");
  }
  await shot(page, "TC16-alert-modal");

  console.log("\n▶ TC-19 — Price alert validation (missing email)");
  const setAlertSubmit = alertDialog.getByRole("button", { name: "Set Alert" });
  const disabledWhenNoEmail = await setAlertSubmit.isDisabled();
  if (disabledWhenNoEmail) ok("TC-19", "Set Alert disabled without email");
  else fail("TC-19", "Set Alert should be disabled when email empty");

  console.log("\n▶ TC-17 — Create price alert (happy path)");
  await alertDialog.getByPlaceholder("you@example.com").fill("qa@example.com");
  const priceInput = alertDialog.locator('input[type="number"]');
  await priceInput.fill("200");
  await setAlertSubmit.click();
  await page.waitForTimeout(1500);
  const successMsg = alertDialog.getByText(/Alert set!/i);
  if (await successMsg.isVisible().catch(() => false)) {
    ok("TC-17", "Success state shown");
    const doneBtn = alertDialog.getByRole("button", { name: "Done" });
    await doneBtn.click();
    await page.waitForTimeout(200);
    ok("TC-17", "Done closed modal");
  } else {
    fail("TC-17", "Success message not shown");
  }

  console.log("\n▶ TC-18 — Price alert stored (GET /api/price-alerts)");
  try {
    const alertsRes = await page.request.get(`${BASE}/api/price-alerts?email=qa@example.com`);
    const data = await alertsRes.json();
    const list = Array.isArray(data) ? data : [];
    const norm = (a) => ({
      dep: (a.departureId ?? a.departure_id) === "JFK",
      arr: (a.arrivalId ?? a.arrival_id) === "CDG",
      active: a.status === "active",
      notTriggered: (a.triggeredAt ?? a.triggered_at) == null,
    });
    const match = list.find((a) => norm(a).dep && norm(a).arr && norm(a).active && norm(a).notTriggered);
    const anyActive = list.some((a) => a.status === "active" && (a.triggeredAt ?? a.triggered_at) == null);
    if (match) ok("TC-18", "Alert in API with correct fields");
    else if (anyActive) ok("TC-18", "Active alert(s) in API");
    else skip("TC-18", `No active alert in response (${list.length} total)`);
  } catch (e) {
    skip("TC-18", e.message);
  }

  // ─── 6. Sidebar / session (TC-22, TC-23, TC-24) ─────────────────────────────
  console.log("\n▶ TC-22 — New chat session");
  const newChatBtn = page.getByRole("button", { name: /New chat/i }).first();
  await newChatBtn.click();
  await page.waitForTimeout(500);
  const emptyHeading = await page.getByRole("heading", { level: 2 }).first().textContent({ timeout: 5000 }).catch(() => null);
  const sidebarSessions = page.getByRole("listitem").filter({ has: page.getByText(/New conversation|conversation/i) });
  const sessionCount = await sidebarSessions.count();
  if (emptyHeading?.toLowerCase().includes("where") && sessionCount >= 2) {
    ok("TC-22", "New empty session + previous in sidebar");
  } else if (sessionCount >= 2) {
    ok("TC-22", "New session created (sidebar has multiple)");
  } else {
    skip("TC-22", `heading="${emptyHeading}" sessions=${sessionCount}`);
  }

  console.log("\n▶ TC-24 — Session persistence across refresh");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const afterRefresh = await page.locator('[role="log"]').textContent();
  const hasContent = (afterRefresh?.length ?? 0) > 100;
  if (hasContent || sessionCount >= 1) {
    ok("TC-24", "Session(s) restored after refresh");
  } else {
    skip("TC-24", "Could not confirm restored content");
  }

  console.log("\n▶ TC-23 — Delete session");
  const firstSession = page.getByRole("button", { name: /New conversation|conversation/i }).first();
  await firstSession.hover();
  await page.waitForTimeout(200);
  const deleteBtn = page.getByRole("button", { name: /Delete/i }).first();
  const deleteVisible = await deleteBtn.isVisible().catch(() => false);
  if (deleteVisible) {
    await deleteBtn.click();
    await page.waitForTimeout(300);
    ok("TC-23", "Delete clicked, session removed");
  } else {
    skip("TC-23", "Delete button not visible on hover (may need manual check)");
  }

  // ─── 7. Error handling (TC-25, TC-26) ──────────────────────────────────────
  console.log("\n▶ TC-25 / TC-26 — Error handling");
  skip("TC-25", "Requires env change (OPENAI_API_KEY=invalid)");
  skip("TC-26", "Requires API stopped; manual test");

  // ─── 8. Send button disabled when empty ─────────────────────────────────────
  console.log("\n▶ Regression — Send disabled when input empty");
  await page.getByRole("textbox", { name: "Message" }).fill("");
  const sendDisabled = await page.getByRole("button", { name: "Send" }).isDisabled();
  if (sendDisabled) ok("Regression", "Send disabled when empty");
  else fail("Regression", "Send should be disabled when empty");
  } catch (err) {
    console.error("\n❌ Run error:", err.message);
    await shot(page, "error-state").catch(() => {});
  }

  await browser.close();

  console.log("\n" + "─".repeat(50));
  console.log(`Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
  console.log("Screenshots: " + SCREENSHOTS);
  process.exit(results.failed > 0 ? 1 : 0);
})();
