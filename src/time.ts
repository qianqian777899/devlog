import type { Period } from './types.js';

// Calendar dates use the machine's local time (or its TZ environment variable).
export function parseDate(value: string, endOfDate = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
      throw new Error(`Invalid calendar date: ${value}`);
    if (endOfDate) date.setDate(date.getDate() + 1);
    return date;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Use YYYY-MM-DD or an ISO timestamp with a timezone offset.');
  parseDate(value.slice(0, 10));
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}
export function getPeriod(command: string, since?: string, until?: string, now = new Date()): Period {
  if (command === 'range') {
    if (!since || !until) throw new Error('range requires --since and --until.');
    const period = { since: parseDate(since), until: parseDate(until, true) };
    if (period.since >= period.until) throw new Error('--since must be before --until.');
    return period;
  }
  if (command !== 'today' && command !== 'week') throw new Error(`Unknown command: ${command}`);
  if (since || until) throw new Error('Use range with --since / --until.');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (command === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return { since: start, until: end };
}
export function inPeriod(timestamp: unknown, period: Period): timestamp is string {
  if (typeof timestamp !== 'string') return false;
  const time = Date.parse(timestamp);
  return time >= period.since.getTime() && time < period.until.getTime();
}
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
