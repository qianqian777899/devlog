export type Language = 'zh' | 'en';
export type Template = 'daily' | 'weekly' | 'okr';
export interface Period { since: Date; until: Date }
export interface Commit {
  repository: string; hash: string; timestamp: string; email: string; message: string;
  files: string[]; additions: number; deletions: number; binaryFiles: number;
}
export interface SessionActivity {
  source: 'codex' | 'claude'; sessionId: string; timestamp: string;
  project: string; kind: 'task' | 'file'; summary: string; files: string[];
}
export interface ReportData {
  period: Period; commits: Commit[]; activities: SessionActivity[]; warnings: string[];
}
export interface AIConfig { baseURL: string; model: string; apiKeyEnv: string; apiKey?: string }
export interface Config {
  roots: string[]; emails: string[]; language: Language;
  codexPath: string | null; claudePath: string | null; ai?: AIConfig;
}
export type Warn = (message: string) => void;
export interface AdapterContext { period: Period; roots: string[]; warn: Warn }
export interface SessionAdapter {
  name: 'codex' | 'claude'; read(path: string, context: AdapterContext): Promise<SessionActivity[]>;
}
