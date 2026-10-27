import type { Config, AIConfig } from './types.js';
export declare function configPath(): string;
export declare function defaults(): Config;
export declare function validateConfig(value: unknown): Config;
export declare function loadConfig(path?: string, explicit?: boolean): Promise<Config>;
export declare function resolveAI(config: Config, env?: NodeJS.ProcessEnv): AIConfig;
export declare function saveConfig(path: string, value: Config, force?: boolean): Promise<void>;
export declare function initConfig(path: string, force: boolean, yes: boolean): Promise<void>;
