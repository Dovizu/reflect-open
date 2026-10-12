import {
  defaultPageDescriber,
  type DescribePageRequest,
  type PageEnrichment,
} from './page-describer-service.ts'

export {
  DescriptionRejectedError,
  isDescriptionRejected,
  normalizedPageTitle,
  type DescribePageRequest,
  type PageEnrichment,
} from './page-describer-service.ts'

/** The title and description of a captured page; see `PageDescriberService.describe`. */
export async function describePage(request: DescribePageRequest): Promise<PageEnrichment> {
  return await defaultPageDescriber().describe(request)
}
