import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Server and lib tests are pure Node; hook tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock
    environment: 'node',
    // dist/ holds compiled copies of the server tests after a desktop build —
    // running them too would double every count and drift from the sources
    exclude: ['**/node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
