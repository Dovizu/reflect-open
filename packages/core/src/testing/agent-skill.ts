import type {
  AgentSkillInstallState,
  AgentSkillService,
  AgentSkillStatus,
} from '../app/agent-skill-service.ts'

export interface TestAgentSkillService extends AgentSkillService {
  setInstallState(state: AgentSkillInstallState): void
  /**
   * Every `install` and `uninstall`, in order.
   */
  calls(): readonly { readonly method: 'install' | 'uninstall' }[]
}

class TestAgentSkillServiceImpl implements TestAgentSkillService {
  #status: AgentSkillStatus
  readonly #log: { method: 'install' | 'uninstall' }[] = []

  constructor(options: Partial<AgentSkillStatus> | undefined) {
    this.#status = {
      skillName: options?.skillName ?? 'reflect-test',
      skillPath: options?.skillPath ?? '/home/.agents/skills/reflect-test/SKILL.md',
      cliPath: options?.cliPath ?? '/app/reflect',
      installState: options?.installState ?? 'missing',
    }
  }

  async status(): Promise<AgentSkillStatus> {
    return { ...this.#status }
  }

  async install(): Promise<AgentSkillStatus> {
    return this.#transition('install', 'current')
  }

  async uninstall(): Promise<AgentSkillStatus> {
    return this.#transition('uninstall', 'missing')
  }

  setInstallState(state: AgentSkillInstallState): void {
    this.#status = { ...this.#status, installState: state }
  }

  calls(): readonly { readonly method: 'install' | 'uninstall' }[] {
    return [...this.#log]
  }

  #transition(method: 'install' | 'uninstall', next: AgentSkillInstallState): AgentSkillStatus {
    this.#log.push({ method })
    if (this.#status.installState === 'conflict') {
      throw new Error(`test agent skill: cannot ${method} over a conflicting file`)
    }
    this.#status = { ...this.#status, installState: next }
    return { ...this.#status }
  }
}

/**
 * An in-memory {@link AgentSkillService}. `install` moves a non-conflicting
 * file to `current`, `uninstall` to `missing`; both reject a `conflict`.
 */
export function createTestAgentSkillService(
  options?: Partial<AgentSkillStatus>,
): TestAgentSkillService {
  return new TestAgentSkillServiceImpl(options)
}
