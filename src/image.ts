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

  const resize = (img: sharp.Sharp, size: number) =>
    img.clone().resize(null, null, {
      [meta.width >= meta.height ? 'width' : 'height']: size,
      kernel: sharp.kernel.cubic,
    })

  const sized = sizes.map(size => resize(image, size))

  await Promise.all(
    formats.map(format =>
      sized.map((img, i) =>
        img[format]().toFile(`img/img${sizes[i]}.${format}`)
      )
    )
  )
}
