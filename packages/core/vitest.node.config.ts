import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'core-node',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    sequence: { groupOrder: 200 },
    retry: process.env.CI ? 3 : 0,
  },
})
