import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'

const agentSkillInstallStateSchema = z.enum(['missing', 'current', 'stale', 'conflict'])

/**
 * Where the installed skill file stands relative to what the app would write
 * today: `missing` (no file), `current` (byte-identical), `stale` (ours, but
 * rendered from older inputs, safe to rewrite), or `conflict` (a file the
 * app doesn't manage; never overwritten or deleted).
 */
export type AgentSkillInstallState = z.infer<typeof agentSkillInstallStateSchema>

const agentSkillStatusSchema = z.object({
  /** The skill's directory name, derived from the graph (`reflect-<slug>`). */
  skillName: z.string(),
  /** Absolute path of the target `SKILL.md` under `~/.agents/skills/`. */
  skillPath: z.string(),
  /** Absolute path of the bundled `reflect` CLI the skill references. */
  cliPath: z.string(),
  installState: agentSkillInstallStateSchema,
})

/** Install status of the open graph's agent skill. */
export type AgentSkillStatus = z.infer<typeof agentSkillStatusSchema>

/** Manages the open graph's agent skill file under `~/.agents/skills/`. */
export interface AgentSkillService {
  /** The open graph's agent-skill install status. Read-only. */
  status(): Promise<AgentSkillStatus>
  /**
   * Write (or refresh) the open graph's `SKILL.md`. Pinned to the graph
   * `generation` like every mutating command; rejects `conflict` files.
   */
  install(generation: number): Promise<AgentSkillStatus>
  /** Remove the open graph's managed skill file. Rejects `conflict` files. */
  uninstall(generation: number): Promise<AgentSkillStatus>
}

export function createAgentSkillService(deps: { ipc: IpcBridgeService }): AgentSkillService {
  const { ipc } = deps
  return {
    status: () => ipc.call('skill_status', {}, agentSkillStatusSchema),
    install: (generation) => ipc.call('skill_install', { generation }, agentSkillStatusSchema),
    uninstall: (generation) => ipc.call('skill_uninstall', { generation }, agentSkillStatusSchema),
  }
}

let defaultService: AgentSkillService | null = null

/** The process-wide `AgentSkillService`; one over the installed bridge unless replaced. */
export function defaultAgentSkill(): AgentSkillService {
  defaultService ??= createAgentSkillService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `AgentSkillService`; `null` restores the bridge-backed one. */
export function setDefaultAgentSkill(service: AgentSkillService | null): void {
  defaultService = service
}
