import axios from 'axios'
import sharp from 'sharp'

export const resize = async (url: string) => {
  const sizes = [256, 512, 1024]
  const formats = ['jpeg', 'webp']

  const { data } = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
  })

  const image = sharp(data)
  const meta = await image.metadata()
  const imgSize = Math.max(meta.width, meta.height)

  const resize = (img: sharp.Sharp, size: number) =>
    img.clone().resize(null, null, {
      [meta.width >= meta.height ? 'width' : 'height']: size,
      kernel: sharp.kernel.cubic,
    })
  const toFormat = (img: sharp.Sharp, format: string) =>
    meta.format === format ? img : img[format]()

  const sized = sizes
    .filter(size => size < imgSize)
    .map(size => ({ img: resize(image, size), size }))

  if (Math.max(...sizes) > imgSize) sized.push({ img: image, size: imgSize })

  await Promise.all(
    formats.map(format =>
      sized.map(({ img, size }) =>
        toFormat(img, format).toFile(`img/img${size}.${format}`)
      )
    )
  )
}
