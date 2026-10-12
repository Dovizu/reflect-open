import { defaultAgentSkill, type AgentSkillStatus } from './agent-skill-service.ts'

export type { AgentSkillInstallState, AgentSkillStatus } from './agent-skill-service.ts'

/** The open graph's agent-skill install status. Read-only. */
export async function agentSkillStatus(): Promise<AgentSkillStatus> {
  return await defaultAgentSkill().status()
}

/** See `AgentSkillService.install`. */
export async function agentSkillInstall(generation: number): Promise<AgentSkillStatus> {
  return await defaultAgentSkill().install(generation)
}

/** See `AgentSkillService.uninstall`. */
export async function agentSkillUninstall(generation: number): Promise<AgentSkillStatus> {
  return await defaultAgentSkill().uninstall(generation)
}
