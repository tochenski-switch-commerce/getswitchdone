// Utility functions for calculating next send times with timezone awareness

function localTimeToUtc(localDateStr: string, hour: number, minute: number, timezone: string): Date {
  const [y, m, d] = localDateStr.split('-').map(Number);
  let utc = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(utc).split(':').map(Number);
    const diff = (hour - parts[0]) * 3_600_000 + (minute - parts[1]) * 60_000;
    if (!diff) break;
    utc = new Date(utc.getTime() + diff);
  }
  return utc;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function computeNextSendAt(
  frequency: string,
  timeOfDay: string,
  dayOfWeek: number | null,
  timezone: string,
): Date {
  const now = new Date();
  const [targetHour, targetMin] = timeOfDay.split(':').map(Number);

  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  const todayDow = new Date(localDateStr + 'T12:00:00Z').getUTCDay();

  if (frequency === 'daily') {
    const candidate = localTimeToUtc(localDateStr, targetHour, targetMin, timezone);
    if (candidate > now) return candidate;
    return localTimeToUtc(addDays(localDateStr, 1), targetHour, targetMin, timezone);
  }

  // weekly
  const targetDow = dayOfWeek ?? 1;
  let daysUntil = (targetDow - todayDow + 7) % 7;
  if (daysUntil === 0) {
    const candidate = localTimeToUtc(localDateStr, targetHour, targetMin, timezone);
    if (candidate > now) return candidate;
    daysUntil = 7;
  }
  return localTimeToUtc(addDays(localDateStr, daysUntil), targetHour, targetMin, timezone);
}
