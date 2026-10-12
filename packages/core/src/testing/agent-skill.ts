import type {
  AgentSkillInstallState,
  AgentSkillService,
  AgentSkillStatus,
} from '../app/agent-skill-service.ts'

export interface TestAgentSkillService extends AgentSkillService {
  setInstallState(state: AgentSkillInstallState): void
  /** The `generation` of every `install` and `uninstall`, in order. */
  calls(): readonly { readonly method: 'install' | 'uninstall'; readonly generation: number }[]
}

/**
 * An in-memory {@link AgentSkillService}. `install` moves a non-conflicting
 * file to `current`, `uninstall` to `missing`; both reject a `conflict`.
 */
export function createTestAgentSkillService(
  options?: Partial<AgentSkillStatus>,
): TestAgentSkillService {
  let status: AgentSkillStatus = {
    skillName: options?.skillName ?? 'reflect-test',
    skillPath: options?.skillPath ?? '/home/.agents/skills/reflect-test/SKILL.md',
    cliPath: options?.cliPath ?? '/app/reflect',
    installState: options?.installState ?? 'missing',
  }
  const log: { method: 'install' | 'uninstall'; generation: number }[] = []

  function transition(
    method: 'install' | 'uninstall',
    generation: number,
    next: AgentSkillInstallState,
  ): AgentSkillStatus {
    log.push({ method, generation })
    if (status.installState === 'conflict') {
      throw new Error(`test agent skill: cannot ${method} over a conflicting file`)
    }
    status = { ...status, installState: next }
    return { ...status }
  }

  return {
    status: async () => ({ ...status }),
    install: async (generation) => transition('install', generation, 'current'),
    uninstall: async (generation) => transition('uninstall', generation, 'missing'),
    setInstallState(state) {
      status = { ...status, installState: state }
    },
    calls: () => [...log],
  }
}
