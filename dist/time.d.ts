import type { Period } from './types.js';
export declare function parseDate(value: string, endOfDate?: boolean): Date;
export declare function getPeriod(command: string, since?: string, until?: string, now?: Date): Period;
export declare function inPeriod(timestamp: unknown, period: Period): timestamp is string;
export declare function localDate(date: Date): string;
