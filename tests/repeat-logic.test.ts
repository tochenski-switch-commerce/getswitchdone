/**
 * Automated tests for the card repeater date logic.
 *
 * Run with:  npx tsx tests/repeat-logic.test.ts
 *
 * Tests:
 *   A. addUnits – date arithmetic (days, weeks, months)
 *   B. getNextRepeatDate – anchor-based next occurrence
 *   C. formatRepeatSummary – human-readable summaries
 *   D. formatNextDate – friendly date string / edge cases
 *   E. isRepeatDueToday – cron-level check (anchored stepping)
 */

/* ── helpers copied locally so we can run without React/Next imports ─── */

type RepeatUnit = 'days' | 'weeks' | 'months';
interface RepeatRule {
  every: number;
  unit: RepeatUnit;
  endDate?: string;
}

function addUnits(date: Date, every: number, unit: RepeatUnit): Date {
  const d = new Date(date);
  if (unit === 'days') d.setDate(d.getDate() + every);
  else if (unit === 'weeks') d.setDate(d.getDate() + every * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + every);
  return d;
}

function getNextRepeatDate(rule: RepeatRule, startDate: string): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate + 'T00:00:00');
  let next = new Date(anchor);
  while (next <= now) {
    next = addUnits(next, rule.every, rule.unit);
  }
  return next;
}

function formatNextDate(rule: RepeatRule, startDate: string): string {
  if (!startDate) return 'Set a start date';
  const next = getNextRepeatDate(rule, startDate);
  if (rule.endDate) {
    const end = new Date(rule.endDate + 'T00:00:00');
    if (next > end) return 'Series ended';
  }
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const UNIT_LABELS: Record<RepeatUnit, [string, string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months'],
};

function formatRepeatSummary(rule: RepeatRule): string {
  const [singular, plural] = UNIT_LABELS[rule.unit];
  if (rule.every === 1) return `Every ${singular}`;
  return `Every ${rule.every} ${plural}`;
}

function isRepeatDueToday(startDate: string, every: number, unit: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate + 'T00:00:00');
  // First occurrence is one interval after the anchor (not the anchor itself)
  let cursor = addUnits(new Date(anchor), every, unit as RepeatUnit);
  while (cursor < now) {
    cursor = addUnits(cursor, every, unit as RepeatUnit);
  }
  return cursor.getTime() === now.getTime();
}

/* ── Test runner ────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, name: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const todayStr = toDateStr(TODAY);

/* ═══════════════════════════════════════════════════════════
   A. addUnits
   ═══════════════════════════════════════════════════════════ */
console.log('\n🔹 A. addUnits');

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 1, 'days')),
  '2026-03-02',
  'add 1 day'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 5, 'days')),
  '2026-03-06',
  'add 5 days'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 1, 'weeks')),
  '2026-03-08',
  'add 1 week'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 2, 'weeks')),
  '2026-03-15',
  'add 2 weeks'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 1, 'months')),
  '2026-04-01',
  'add 1 month'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-01-31T00:00:00'), 1, 'months')),
  '2026-03-03',
  'add 1 month from Jan 31 (overflow to Mar)'
);

assertEqual(
  toDateStr(addUnits(new Date('2026-03-01T00:00:00'), 12, 'months')),
  '2027-03-01',
  'add 12 months = 1 year'
);

/* ═══════════════════════════════════════════════════════════
   B. getNextRepeatDate
   ═══════════════════════════════════════════════════════════ */
console.log('\n🔹 B. getNextRepeatDate');

// Anchor 7 days ago, every 1 day → next should be tomorrow
{
  const sevenAgo = new Date(TODAY);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const next = getNextRepeatDate({ every: 1, unit: 'days' }, toDateStr(sevenAgo));
  const tomorrow = new Date(TODAY);
  tomorrow.setDate(tomorrow.getDate() + 1);
  assertEqual(toDateStr(next), toDateStr(tomorrow), 'every 1 day, anchor 7 days ago → tomorrow');
}

// Anchor today, every 2 weeks → next should be 2 weeks from today
{
  const next = getNextRepeatDate({ every: 2, unit: 'weeks' }, todayStr);
  const expected = new Date(TODAY);
  expected.setDate(expected.getDate() + 14);
  assertEqual(toDateStr(next), toDateStr(expected), 'every 2 weeks, anchor=today → +14 days');
}

// Anchor far in the future → next should be the anchor date itself
{
  const future = new Date(TODAY);
  future.setDate(future.getDate() + 100);
  const next = getNextRepeatDate({ every: 1, unit: 'days' }, toDateStr(future));
  assertEqual(toDateStr(next), toDateStr(future), 'anchor in future → stays at anchor');
}

// Anchor yesterday, every 3 days → next should be anchor + 3 days
{
  const yesterday = new Date(TODAY);
  yesterday.setDate(yesterday.getDate() - 1);
  const next = getNextRepeatDate({ every: 3, unit: 'days' }, toDateStr(yesterday));
  const expected = new Date(yesterday);
  expected.setDate(expected.getDate() + 3);
  // If expected is still <= today, step once more
  if (expected <= TODAY) expected.setDate(expected.getDate() + 3);
  assertEqual(toDateStr(next), toDateStr(expected), 'every 3 days, anchor=yesterday → +3 days');
}

// Anchor 14 days ago, every 2 weeks → next should be tomorrow (anchor + 2*7 = today, so +1 more step)
{
  const twoWeeksAgo = new Date(TODAY);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const next = getNextRepeatDate({ every: 2, unit: 'weeks' }, toDateStr(twoWeeksAgo));
  // anchor + 14 days = today, which is <= now, so next step = anchor + 28 days
  const expected = new Date(twoWeeksAgo);
  expected.setDate(expected.getDate() + 28);
  assertEqual(toDateStr(next), toDateStr(expected), 'every 2 weeks, anchor=14d ago → next is +28d from anchor');
}

/* ═══════════════════════════════════════════════════════════
   C. formatRepeatSummary
   ═══════════════════════════════════════════════════════════ */
console.log('\n🔹 C. formatRepeatSummary');

assertEqual(formatRepeatSummary({ every: 1, unit: 'days' }), 'Every day', 'every 1 day → "Every day"');
assertEqual(formatRepeatSummary({ every: 2, unit: 'days' }), 'Every 2 days', '2 days');
assertEqual(formatRepeatSummary({ every: 1, unit: 'weeks' }), 'Every week', '1 week');
assertEqual(formatRepeatSummary({ every: 3, unit: 'weeks' }), 'Every 3 weeks', '3 weeks');
assertEqual(formatRepeatSummary({ every: 1, unit: 'months' }), 'Every month', '1 month');
assertEqual(formatRepeatSummary({ every: 6, unit: 'months' }), 'Every 6 months', '6 months');
assertEqual(formatRepeatSummary({ every: 12, unit: 'months' }), 'Every 12 months', '12 months');

/* ═══════════════════════════════════════════════════════════
   D. formatNextDate
   ═══════════════════════════════════════════════════════════ */
console.log('\n🔹 D. formatNextDate');

assertEqual(formatNextDate({ every: 1, unit: 'days' }, ''), 'Set a start date', 'no start date → prompt');

// End date in the distant past → "Series ended"
assertEqual(
  formatNextDate({ every: 1, unit: 'days', endDate: '2020-01-01' }, '2019-01-01'),
  'Series ended',
  'end date in past → Series ended'
);

// Valid future date should return a formatted date string
{
  const result = formatNextDate({ every: 1, unit: 'days' }, todayStr);
  assert(result !== 'Set a start date' && result !== 'Series ended', 'valid start → returns a date string');
  // Should match pattern like "Mon, Mar 10" etc.
  assert(result.length > 5, 'date string has reasonable length');
}

// End date far in the future → should still return a date (not "Series ended")
{
  const result = formatNextDate({ every: 1, unit: 'weeks', endDate: '2030-12-31' }, todayStr);
  assert(result !== 'Series ended', 'far future endDate → not ended');
}

/* ═══════════════════════════════════════════════════════════
   E. isRepeatDueToday
   ═══════════════════════════════════════════════════════════ */
console.log('\n🔹 E. isRepeatDueToday (cron logic)');

// Start date today, every 1 day → today IS the anchor, but anchor <= now → steps to tomorrow, so NOT due
assert(!isRepeatDueToday(todayStr, 1, 'days'), 'start=today, every 1 day → not due (steps past)');

// Start date yesterday, every 1 day → yesterday+1 = today → cursor lands on today before stepping → BUT let's check
{
  const yesterday = new Date(TODAY);
  yesterday.setDate(yesterday.getDate() - 1);
  // anchor=yesterday, cursor starts at yesterday. yesterday < now → step to yesterday+1=today.
  // cursor (today) is NOT < now (today), so loop exits. cursor === now → true
  assert(isRepeatDueToday(toDateStr(yesterday), 1, 'days'), 'start=yesterday, every 1 day → due today');
}

// Start date 7 days ago, every 7 days → due today
{
  const sevenAgo = new Date(TODAY);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  assert(isRepeatDueToday(toDateStr(sevenAgo), 7, 'days'), 'start=7d ago, every 7 days → due today');
}

// Start date 7 days ago, every 3 days → 7 is not a multiple of 3 → not due
{
  const sevenAgo = new Date(TODAY);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  assert(!isRepeatDueToday(toDateStr(sevenAgo), 3, 'days'), 'start=7d ago, every 3 days → NOT due');
}

// Start date 6 days ago, every 3 days → 6/3 = 2, exact → due today
{
  const sixAgo = new Date(TODAY);
  sixAgo.setDate(sixAgo.getDate() - 6);
  assert(isRepeatDueToday(toDateStr(sixAgo), 3, 'days'), 'start=6d ago, every 3 days → due today');
}

// Start date 14 days ago, every 2 weeks → 14 days / 14 = 1 → due today
{
  const fourteenAgo = new Date(TODAY);
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  assert(isRepeatDueToday(toDateStr(fourteenAgo), 2, 'weeks'), 'start=14d ago, every 2 weeks → due today');
}

// Start date 13 days ago, every 2 weeks → not due
{
  const thirteenAgo = new Date(TODAY);
  thirteenAgo.setDate(thirteenAgo.getDate() - 13);
  assert(!isRepeatDueToday(toDateStr(thirteenAgo), 2, 'weeks'), 'start=13d ago, every 2 weeks → NOT due');
}

// Monthly: same day N months ago
{
  const nMonthsAgo = new Date(TODAY);
  nMonthsAgo.setMonth(nMonthsAgo.getMonth() - 3);
  // If today's day matches (no overflow), every 3 months should land exactly on today
  if (nMonthsAgo.getDate() === TODAY.getDate()) {
    assert(isRepeatDueToday(toDateStr(nMonthsAgo), 3, 'months'), 'start=3 months ago (same day) → due today');
  } else {
    console.log('  ⏭️  Skipping monthly same-day test (day overflow)');
  }
}

// Monthly: 1 month ago, every 2 months → not due
{
  const oneMonthAgo = new Date(TODAY);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  if (oneMonthAgo.getDate() === TODAY.getDate()) {
    assert(!isRepeatDueToday(toDateStr(oneMonthAgo), 2, 'months'), 'start=1mo ago, every 2 months → NOT due');
  } else {
    console.log('  ⏭️  Skipping monthly mismatch test (day overflow)');
  }
}

// Future start date → never due today
{
  const future = new Date(TODAY);
  future.setDate(future.getDate() + 30);
  assert(!isRepeatDueToday(toDateStr(future), 1, 'days'), 'future start → NOT due today');
}

/* ═══════════════════════════════════════════════════════════
   Results
   ═══════════════════════════════════════════════════════════ */
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n⚠️  Some tests failed!\n');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
}
