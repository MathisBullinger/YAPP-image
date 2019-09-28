// @ts-ignore
import sharp from 'sharp'

type Format = 'jpeg' | 'webp'

export const resize = async (
  data: Buffer,
  sizes: number[],
  formats: Format[] = ['jpeg', 'webp']
) => {
  const img = sharp(data)
  const meta = await img.metadata()

  const imgSize = Math.min(meta.width, meta.height)
  if (Math.max(...sizes) > imgSize)
    sizes = [...sizes.filter(size => size < imgSize), imgSize]

  const sized = sizes.map(size => ({ img: resizeImg(img, size), size }))

  return formats.flatMap(format =>
    sized.map(({ img: raw, size }) =>
      (meta.format === format ? raw : raw[format]())
        .toBuffer()
        .then(img => ({ img, size, format }))
    )
  )
}

const resizeImg = (img: sharp.Sharp, size: number): sharp.Sharp =>
  img.clone().resize(size, size, {
    fit: 'cover',
    kernel: sharp.kernel.lanczos3,
  })
