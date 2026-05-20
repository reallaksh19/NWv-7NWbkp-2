import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.cert.test.{js,jsx,ts,tsx}',
      'src/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'src/services/frontPageComposer.test.js',
      'src/services/upAheadService.test.js',
      'src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts'
    ],
    globals: true,
    passWithNoTests: false,
    testTimeout: 30000
  }
});