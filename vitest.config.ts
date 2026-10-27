import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // CLI tests launch multiple real Node/Git processes; Windows runners need
    // more startup time than parser-only tests.
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
