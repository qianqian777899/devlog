import type { AdapterContext, SessionActivity } from '../types.js';
export declare function textContent(content: unknown): string;
export declare function summarize(text: string): string;
export declare function instruction(text: string): boolean;
export declare function scopedProject(cwd: unknown, context: AdapterContext): Promise<string | undefined>;
export declare function toolFiles(name: unknown, input: unknown): string[];
export declare function uniqueActivities(items: SessionActivity[]): SessionActivity[];
