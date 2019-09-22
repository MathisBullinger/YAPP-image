import fs from 'fs'
import axios from 'axios'
import sharp from 'sharp'

export const resize = async (url: string) => {
  const sizes = [256, 512, 1024]
  const formats = ['jpeg', 'webp']

  axios({ method: 'get', url, responseType: 'arraybuffer' }).then(
    ({ data }) => {
      const image = sharp(data)
      sizes.forEach(size => {
        image.metadata().then(meta => {
          const tmp = image.resize({
            [meta.width >= meta.height ? 'width' : 'height']: size,
            kernel: sharp.kernel.cubic,
          })
          formats.forEach(format =>
            tmp[format]()
              .toBuffer()
              .then(data => {
                const fsStream = fs.createWriteStream(
                  `img/img${size}.${format}`
                )
                fsStream.write(data)
                fsStream.end()
              })
          )
        })
      })
    }
  )
}
