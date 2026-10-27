import type { AdapterContext, SessionActivity, SessionAdapter } from '../types.js';
export declare class CodexAdapter implements SessionAdapter {
    readonly name: "codex";
    read(path: string, context: AdapterContext): Promise<SessionActivity[]>;
}
