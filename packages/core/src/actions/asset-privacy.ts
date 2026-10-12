import { defaultAssetPrivacy, type AssetVerdict } from '../assets/asset-privacy-service.ts'

export type { AssetVerdict } from '../assets/asset-privacy-service.ts'

/** `defaultAssetPrivacy().classifyAssetFromNotes`. */
export async function classifyAssetFromNotes(
  assetPath: string,
  candidates: readonly string[],
  readSource: (notePath: string) => Promise<string>,
  knownOwners?: readonly string[],
): Promise<AssetVerdict> {
  return await defaultAssetPrivacy().classifyAssetFromNotes(
    assetPath,
    candidates,
    readSource,
    knownOwners,
  )
}
