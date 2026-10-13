import type {
  AgentSkillInstallState,
  AgentSkillService,
  AgentSkillStatus,
} from '../app/agent-skill-service.ts'

export interface TestAgentSkillService extends AgentSkillService {
  setInstallState(state: AgentSkillInstallState): void
  /** Every `install` and `uninstall`, in order. */
  calls(): readonly { readonly method: 'install' | 'uninstall' }[]
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
  const log: { method: 'install' | 'uninstall' }[] = []

  function transition(
    method: 'install' | 'uninstall',
    next: AgentSkillInstallState,
  ): AgentSkillStatus {
    log.push({ method })
    if (status.installState === 'conflict') {
      throw new Error(`test agent skill: cannot ${method} over a conflicting file`)
    }
    status = { ...status, installState: next }
    return { ...status }
  }

  return {
    status: async () => ({ ...status }),
    install: async () => transition('install', 'current'),
    uninstall: async () => transition('uninstall', 'missing'),
    setInstallState(state) {
      status = { ...status, installState: state }
    },
    calls: () => [...log],
  }
}
