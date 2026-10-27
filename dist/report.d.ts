import type { Language, ReportData, Template } from './types.js';
export declare function md(value: string): string;
export declare function renderReport(data: ReportData, language: Language, template: Template): string;
