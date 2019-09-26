import 'core-js/fn/array/flat-map'
import * as db from './dynamodb'
import { S3 } from 'aws-sdk'
import { resize } from './image'

const s3 = new S3()

export const image = async event => {
  console.log(...event.Records.map(e => e.eventName))

  // get newly inserted items
  const items: db.Item[] = event.Records.filter(
    ({ eventName }) => eventName === 'INSERT'
  ).map(event => formatData(event.dynamodb.NewImage))

  if (items.length === 0) return

  console.log('podcast:', ...new Set(items.map(item => item.podId)))

  // bundle by podId
  const podcasts: {
    [key: string]: db.Item[]
  } = items.reduce(
    (a, c) => ({
      ...a,
      ...{
        [c.podId]: [...(c.podId in a ? a[c.podId] : []), c],
      },
    }),
    {}
  )

  // add missing meta info
  const metaQueries = Object.entries(podcasts)
    .filter(([, v]) => !v.find(({ SK }) => SK === 'meta'))
    .map(([podId]) => ({
      podId,
      SK: 'meta',
    }))

  if (metaQueries.length) {
    console.log('get missing:', ...metaQueries.map(({ podId }) => podId))
    const result = await db.batchGet(metaQueries)
    console.log('result:', result)
    result.forEach(meta => podcasts[meta.podId].push(meta))
  }

  let imgReq = []
  for (const podcast of Object.values(podcasts)) {
    const [meta] = podcast.splice(
      podcast.findIndex(({ SK }) => SK === 'meta'),
      1
    )
    if (meta.img) imgReq.push(meta)
    for (const episode of podcast) {
      if (!episode.img || episode.img === meta.img) continue
      imgReq.push(episode)
    }
  }
  imgReq = imgReq.filter(req =>
    Object.keys(req).find(key =>
      key.startsWith('img_') ? (console.log('skip', req.title), false) : true
    )
  )

  // resize images, upload to s3 and link in db
  await Promise.all(
    imgReq.map(({ img: url, podId, SK }) =>
      resize(url).then(imgArr =>
        Promise.all(
          imgArr.map(({ img, size, format }) =>
            Promise.all([img, storeImgLink(podId, SK, size, format)])
              .then(([data]) =>
                upload(`${podId}_${SK}_${size}.${format}`, data)
              )
              .catch(err => {
                if (err.code === 'ConditionalCheckFailedException')
                  console.log("item doesn't exist any more")
                else throw err
              })
          )
        )
      )
    )
  )

  return { statusCode: 200 }
}

function upload(name: string, data: Buffer): Promise<void> {
  return new Promise((resolve: () => void, reject) => {
    s3.upload({
      Bucket: 'yapp-images',
      Key: name,
      Body: data,
      ACL: 'public-read',
    })
      .promise()
      .then(resolve)
      .catch(err => {
        console.log('error while upload image', name)
        reject(err)
      })
  })
}

const storeImgLink = (
  podId: string,
  SK: string,
  size: number,
  format: string
) =>
  db.update(
    { podId, SK },
    {
      [`img_${format}_${size}`]: `https://yapp-images.s3.amazonaws.com/_${podId}_${SK}_${size}.${format}`,
    }
  )

const formatData = data =>
  Object.entries(data)
    .filter(([k]) => ['podId', 'SK', 'img'].includes(k))
    .reduce((a, [k, v]) => Object.assign(a, { [k]: v['S'] }), {})
