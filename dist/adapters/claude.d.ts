import type { AdapterContext, SessionActivity, SessionAdapter } from '../types.js';
export declare class ClaudeAdapter implements SessionAdapter {
    readonly name: "claude";
    read(path: string, context: AdapterContext): Promise<SessionActivity[]>;
}
