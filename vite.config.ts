import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VERCEL_GIT_COMMIT_SHA is auto-set when deploying via Git integration
// For CLI deploys, we write .build-hash before deploying
import { readFileSync } from 'fs';
const commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || (() => { try { return readFileSync('.build-hash', 'utf-8').trim(); } catch { return 'dev'; } })();
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    host: '0.0.0.0',
    port: 5183,
  },
});
