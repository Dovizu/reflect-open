import { afterEach, describe, expect, it } from 'vitest'
import { createTestAgentSkillService } from '../testing/agent-skill.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { agentSkillInstall } from './agent-skill.ts'
import {
  createAgentSkillService,
  defaultAgentSkill,
  setDefaultAgentSkill,
} from './agent-skill-service.ts'

const STATUS = {
  skillName: 'reflect-notes',
  skillPath: '/home/.agents/skills/reflect-notes/SKILL.md',
  cliPath: '/app/reflect',
  installState: 'missing',
}

afterEach(() => {
  setDefaultAgentSkill(null)
})

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

describe('defaultAgentSkill', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestAgentSkillService()
    setDefaultAgentSkill(fake)
    expect(defaultAgentSkill()).toBe(fake)

    setDefaultAgentSkill(null)
    expect(defaultAgentSkill()).not.toBe(fake)
  })

  it('backs the free functions', async () => {
    const fake = createTestAgentSkillService()
    setDefaultAgentSkill(fake)

    await expect(agentSkillInstall(7)).resolves.toMatchObject({ installState: 'current' })
    expect(fake.calls()).toEqual([{ method: 'install', generation: 7 }])
  })
})
