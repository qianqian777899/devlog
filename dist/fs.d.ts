import type { Warn } from './types.js';
export declare function expandPath(path: string): string;
export declare function isWithin(path: string, root: string): boolean;
export declare function canonicalRoots(roots: string[], warn: Warn): Promise<string[]>;
export declare function walk(root: string, warn: Warn, maxEntries?: number): AsyncGenerator<{
    path: string;
    repository: boolean;
}>;
export declare function jsonLines(file: string, warn: Warn): AsyncGenerator<Record<string, unknown>>;
export declare function sessionFiles(root: string, warn: Warn): AsyncGenerator<string>;
export declare function object(value: unknown): Record<string, unknown>;
