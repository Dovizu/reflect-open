import { describe, expect, it } from 'vitest'
import { createTestIpcBridgeService } from '../testing/ipc.ts'

import { createAgentSkillService } from './agent-skill-service.ts'

const STATUS = {
  skillName: 'reflect-notes',
  skillPath: '/home/.agents/skills/reflect-notes/SKILL.md',
  cliPath: '/app/reflect',
  installState: 'missing',
}
describe('createAgentSkillService', () => {
  it('reads the status and pins mutations to the generation', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        skill_status: () => STATUS,
        skill_install: () => ({ ...STATUS, installState: 'current' }),
        skill_uninstall: () => STATUS,
      },
    })
    const skill = createAgentSkillService({ ipc })

    await expect(skill.status()).resolves.toEqual(STATUS)
    await expect(skill.install(3)).resolves.toMatchObject({ installState: 'current' })
    await expect(skill.uninstall(4)).resolves.toMatchObject({ installState: 'missing' })
    expect(ipc.calls()).toEqual([
      { command: 'skill_status', args: {} },
      { command: 'skill_install', args: { generation: 3 } },
      { command: 'skill_uninstall', args: { generation: 4 } },
    ])
  })

  it('rejects an unknown install state with a parse error', async () => {
    const ipc = createTestIpcBridgeService({
      commands: { skill_status: () => ({ ...STATUS, installState: 'weird' }) },
    })
    await expect(createAgentSkillService({ ipc }).status()).rejects.toMatchObject({
      kind: 'parse',
    })
  })
})
