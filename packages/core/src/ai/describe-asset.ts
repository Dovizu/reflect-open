import { defaultAssetDescriber, type DescribeAssetRequest } from './asset-describer-service.ts'

export {
  AssetDescriptionRejectedError,
  isAssetDescriptionRejected,
  type AssetKind,
  type DescribeAssetRequest,
} from './asset-describer-service.ts'

/** The description Markdown of one asset; see `AssetDescriberService.describe`. */
export async function describeAsset(request: DescribeAssetRequest): Promise<string> {
  return await defaultAssetDescriber().describe(request)
}
