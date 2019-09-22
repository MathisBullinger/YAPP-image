import fs from 'fs'
import axios from 'axios'
import sharp from 'sharp'

export const resize = async (url: string) => {
  axios({ method: 'get', url, responseType: 'arraybuffer' }).then(
    ({ data }) => {
      const fsStream = fs.createWriteStream('img/img.jpg')

      const image = sharp(data)
      image
        .metadata()
        .then(({ width, height }) =>
          image
            .resize({
              [width >= height ? 'width' : 'height']: 500,
              kernel: sharp.kernel.cubic,
            })
            .jpeg()
            .toBuffer()
        )
        .then(function(data) {
          fsStream.write(data)
          fsStream.end()
        })
    }
  )
}
