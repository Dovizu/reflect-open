import { defaultBacklinkTarget } from '../capture/backlink-target-service.ts'

/** `defaultBacklinkTarget().ensure`. */
export async function ensureBacklinkTarget(title: string, generation: number): Promise<string> {
  return await defaultBacklinkTarget().ensure(title, generation)
}
