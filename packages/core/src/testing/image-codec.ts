import type {
  DecodedImage,
  ImageCodecService,
  ImageEncodeOptions,
} from '../app/image-codec-service.ts'

export interface TestImageSize {
  readonly width: number
  readonly height: number
}

export interface TestImageEncode {
  readonly file: Blob
  readonly type: string
  readonly quality: number
  readonly width: number
  readonly height: number
}

export interface TestImageCodecService extends ImageCodecService {
  decodedFiles(): readonly Blob[]
  encodes(): readonly TestImageEncode[]
  /** The number of decoded images not yet closed. */
  openImages(): number
  /** Make later encodes resolve `null`; `false` makes them succeed again. */
  failEncodes(fail: boolean): void
}

/**
 * An {@link ImageCodecService} that decodes without reading pixels. `size`
 * gives each file's dimensions, or `null` for an undecodable file. By default
 * every `image/*` blob decodes as 1×1. An encode resolves a blob of the
 * requested type whose text is `encoded <width>x<height>`.
 */
export function createTestImageCodec(options?: {
  size?: (file: Blob) => TestImageSize | null
}): TestImageCodecService {
  const size =
    options?.size ??
    ((file: Blob): TestImageSize | null =>
      file.type.startsWith('image/') ? { width: 1, height: 1 } : null)
  const decoded: Blob[] = []
  const encoded: TestImageEncode[] = []
  let open = 0
  let failing = false

  return {
    async decode(file) {
      const dimensions = size(file)
      if (dimensions === null) {
        return null
      }
      decoded.push(file)
      open += 1
      let closed = false
      const image: DecodedImage = {
        width: dimensions.width,
        height: dimensions.height,
        async encode(encodeOptions: ImageEncodeOptions) {
          if (failing) {
            return null
          }
          const width = encodeOptions.width ?? dimensions.width
          const height = encodeOptions.height ?? dimensions.height
          encoded.push({
            file,
            type: encodeOptions.type,
            quality: encodeOptions.quality,
            width,
            height,
          })
          return new Blob([`encoded ${width}x${height}`], { type: encodeOptions.type })
        },
        close() {
          if (!closed) {
            closed = true
            open -= 1
          }
        },
      }
      return image
    },
    decodedFiles: () => [...decoded],
    encodes: () => [...encoded],
    openImages: () => open,
    failEncodes(fail) {
      failing = fail
    },
  }
}
