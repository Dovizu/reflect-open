import { defaultAssetStore } from './asset-store-service.ts'

/** `defaultAssetStore().uploadBlob`. */
export async function createAsset(
  desiredName: string,
  contents: Blob,
  generation: number,
): Promise<string> {
  return await defaultAssetStore().uploadBlob(desiredName, contents, generation)
}

/** `defaultAssetStore().importFile`. */
export async function importAsset(
  sourcePath: string,
  desiredName: string,
  generation: number,
): Promise<string> {
  return await defaultAssetStore().importFile(sourcePath, desiredName, generation)
}
