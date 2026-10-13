import { defineDesktopProject } from './vitest.shared.ts'

export default defineDesktopProject({
  test: {
    name: 'node',
    isolate: false,
    fsModuleCache: true,
    environment: 'node',
    sequence: { groupOrder: 200 },
    include: ['src/**/*.test.ts'],
  },
})
