import type { Commit, Period, Warn } from './types.js';
export declare function parseNumstat(raw: string): Pick<Commit, 'files' | 'additions' | 'deletions' | 'binaryFiles'>;
export declare function collectGit(roots: string[], period: Period, emails: string[], allAuthors: boolean, warn: Warn): Promise<Commit[]>;
