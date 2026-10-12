import type { DecodedImage, ImageCodecService } from '@reflect/core'

/** An {@link ImageCodecService} over `createImageBitmap` and a `<canvas>`. */
export function createBrowserImageCodec(): ImageCodecService {
  return {
    async decode(file) {
      if (typeof createImageBitmap !== 'function') {
        return null
      }
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(file)
      } catch {
        return null
      }
      const image: DecodedImage = {
        width: bitmap.width,
        height: bitmap.height,
        async encode(options) {
          const canvas = document.createElement('canvas')
          canvas.width = options.width ?? bitmap.width
          canvas.height = options.height ?? bitmap.height
          const context = canvas.getContext('2d')
          if (context === null) {
            return null
          }
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, options.type, options.quality)
          })
        },
        close() {
          bitmap.close()
        },
      }
      return image
    },
  }
}
