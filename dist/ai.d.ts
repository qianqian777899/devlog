import type { AIConfig, Language } from './types.js';
export declare function endpoint(baseURL: string): URL;
export declare function polishReport(report: string, config: AIConfig, language: Language, paths?: string[], fetcher?: typeof fetch): Promise<string>;
