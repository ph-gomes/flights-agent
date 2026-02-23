/**
 * Playwright smoke test for the Thrifty Flight Agent.
 * Run with: node scripts/browser-test.mjs
 * Screenshots are saved to scripts/screenshots/
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = join(__dirname, 'screenshots');
mkdirSync(SCREENSHOTS, { recursive: true });

const BASE = 'http://localhost:5173';
const TIMEOUT = 90_000; // 90s for AI responses

async function shot(page, name) {
  const p = join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`📸  ${name}.png`);
  return p;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── 1. Empty state ─────────────────────────────────────────────────────────
  console.log('\n▶ 1. Loading home page…');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot(page, '01-home-empty-state');

  const heading = await page.textContent('h2');
  const chips = await page.$$('.app-chip');
  console.log(`   Heading: "${heading}"`);
  console.log(`   Suggested query chips: ${chips.length}`);

  // ── 2. Click first suggestion chip ────────────────────────────────────────
  console.log('\n▶ 2. Clicking first suggestion chip…');
  const firstChip = chips[0];
  const chipText = await firstChip.textContent();
  console.log(`   Chip: "${chipText?.trim()}"`);
  await firstChip.click();

  // Capture skeleton loading state quickly
  await page.waitForTimeout(500);
  await shot(page, '02-loading-skeleton');

  const typingIndicator = await page.$('.typing-dot');
  console.log(`   Typing indicator visible: ${!!typingIndicator}`);
  const skeletons = await page.$$('.foc-skeleton');
  console.log(`   Skeleton cards: ${skeletons.length}`);

  // ── 3. Wait for AI response with flight cards ──────────────────────────────
  console.log('\n▶ 3. Waiting for AI flight results (up to 90s)…');
  try {
    await page.waitForSelector('.foc:not(.foc-skeleton)', { timeout: TIMEOUT });
    await page.waitForTimeout(300);
    await shot(page, '03-flight-results');

    const cards = await page.$$('.foc:not(.foc-skeleton)');
    console.log(`   Flight cards rendered: ${cards.length}`);

    const resultsTitle = await page.$('.flight-results-title');
    if (resultsTitle) {
      console.log(`   Results title: "${await resultsTitle.textContent()}"`);
    }

    const lowestBadge = await page.$('.flight-results-lowest strong');
    if (lowestBadge) {
      console.log(`   Lowest price: "${await lowestBadge.textContent()}"`);
    }

    const cheapestBadge = await page.$('.foc-badge-cheapest');
    if (cheapestBadge) {
      console.log(`   Cheapest badge visible: yes`);
    }

    const airlineLogo = await page.$('.foc-airline-logo');
    console.log(`   Airline logo loaded: ${!!airlineLogo}`);

    const co2Badge = await page.$('.foc-badge-eco');
    console.log(`   Low CO₂ badge visible: ${!!co2Badge}`);

    // ── 4. Expand flight details ─────────────────────────────────────────────
    console.log('\n▶ 4. Expanding flight details on first card…');
    const detailsToggle = await page.$('.foc-details-toggle');
    if (detailsToggle) {
      await detailsToggle.click();
      await page.waitForTimeout(200);
      await shot(page, '04-flight-details-expanded');

      const segmentRow = await page.$('.foc-segment-row');
      console.log(`   Segment row visible: ${!!segmentRow}`);

      const flightNum = await page.$('.foc-seg-flight-num');
      if (flightNum) {
        console.log(`   Flight number: "${await flightNum.textContent()}"`);
      }

      const layover = await page.$('.foc-layover');
      console.log(`   Layover pill visible: ${!!layover}`);
    } else {
      console.log('   No details toggle found (direct flight with single segment)');
    }

    // ── 5. Follow-up message ─────────────────────────────────────────────────
    console.log('\n▶ 5. Sending follow-up message…');
    await page.fill('input[aria-label="Message"]', 'What is the cheapest option?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await shot(page, '05-followup-loading');

    await page.waitForSelector('.foc:not(.foc-skeleton)', { timeout: TIMEOUT });
    await page.waitForTimeout(300);
    await shot(page, '06-followup-results');

    const allMessages = await page.$$('.message');
    console.log(`   Total messages in chat: ${allMessages.length}`);

    // ── 6. Price history panel ───────────────────────────────────────────────
    console.log('\n▶ 6. Opening price history panel…');
    const historyChip = await page.$('.app-chip-accent');
    if (historyChip) {
      const chipLabel = await historyChip.textContent();
      console.log(`   History chip: "${chipLabel?.trim()}"`);
      await historyChip.click();
      await page.waitForTimeout(600);
      await shot(page, '07-price-history-panel');

      const panel = await page.$('.price-history-panel');
      console.log(`   Panel visible: ${!!panel}`);

      const chart = await page.$('.recharts-wrapper');
      console.log(`   Recharts chart rendered: ${!!chart}`);

      const stats = await page.$$('.ph-stat');
      console.log(`   Stats boxes: ${stats.length}`);

      const emptyState = await page.$('.ph-empty');
      if (emptyState) {
        console.log(`   Empty state shown (no history yet for this route)`);
      }

      // Close the panel
      console.log('\n▶ 7. Closing price history panel…');
      const closeBtn = await page.$('.ph-close-btn');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        await shot(page, '08-panel-closed');
        const panelAfter = await page.$('.price-history-panel');
        console.log(`   Panel closed: ${!panelAfter}`);
      }
    } else {
      console.log('   Price history chip not found (no route detected yet)');
      await shot(page, '07-no-history-chip');
    }

  } catch (err) {
    console.error(`\n❌ Timed out waiting for results: ${err.message}`);
    await shot(page, 'error-state');
  }

  // ── 8. Error handling: empty input ──────────────────────────────────────────
  console.log('\n▶ 8. Checking send button disabled with empty input…');
  await page.fill('input[aria-label="Message"]', '');
  const sendBtn = await page.$('.app-input-send');
  const isDisabled = await sendBtn?.isDisabled();
  console.log(`   Send button disabled when input is empty: ${isDisabled}`);

  await browser.close();
  console.log('\n✅ Browser test complete. Screenshots saved to scripts/screenshots/');
})();
