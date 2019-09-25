import axios from 'axios'
// @ts-ignore
import sharp from 'sharp'

export const resize = async (
  url: string,
  sizes: number[] = [256, 512, 1024]
): Promise<({ img: Promise<Buffer>; size: number; format: string })[]> => {
  const formats = ['jpeg', 'webp']

  const { data } = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
  })

  const image = sharp(data)
  const meta = await image.metadata()
  const imgSize = Math.max(meta.width, meta.height)

  const resize = (img: sharp.Sharp, size: number): sharp.Sharp =>
    img.clone().resize(null, null, {
      [meta.width >= meta.height ? 'width' : 'height']: size,
      kernel: sharp.kernel.cubic,
    })
  const toFormat = (img: sharp.Sharp, format: string): sharp.Sharp =>
    meta.format === format ? img : img[format]()

  const sized = sizes
    .filter(size => size < imgSize)
    .map(size => ({ img: resize(image, size), size }))

  if (Math.max(...sizes) > imgSize) sized.push({ img: image, size: imgSize })

  return formats.flatMap(format =>
    sized.map(({ img, size }) => ({
      img: toFormat(img, format).toBuffer(),
      size,
      format,
    }))
  )
}
