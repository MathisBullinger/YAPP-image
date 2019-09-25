import 'core-js/fn/array/flat-map'
import dbClient from './dynamodb'
import { S3 } from 'aws-sdk'
import { resize } from './image'

const s3 = new S3()

export const image = async event => {
  // get newly inserted items
  const items: Item[] = event.Records.filter(
    ({ eventName }) => eventName === 'INSERT'
  ).map(event => formatData(event.dynamodb.NewImage))
  if (items.length === 0) return { statusCode: 200 }

  // bundle by podId
  const podcasts: {
    [key: string]: Item[]
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
    const { result } = await dbClient
      .newBatchGetBuilder()
      .requestItems('podcasts', metaQueries)
      .execute()
    result.podcasts.forEach(meta => podcasts[meta.podId].push(meta))
  }

  const imgReq = []
  for (const podcast of Object.values(podcasts)) {
    const [meta] = podcast.splice(
      podcast.findIndex(({ SK }) => SK === 'meta'),
      1
    )
    imgReq.push(meta)
    for (const episode of podcast) {
      if (!episode.img || episode.img === meta.img) continue
      imgReq.push(episode)
    }
  }

  // resize images, upload to s3 and link in db
  await Promise.all(
    imgReq.map(({ img: url, podId, SK }) =>
      resize(url).then(imgArr =>
        Promise.all(
          imgArr.map(({ img, size, format }) =>
            Promise.all([
              img.then(data =>
                upload(`${podId}_${SK}_${size}.${format}`, data)
              ),
              storeImgLink(podId, SK, size, format),
            ])
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

function storeImgLink(
  podId: string,
  SK: string,
  size: number,
  format: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    dbClient
      .newUpdateBuilder('podcasts')
      .setHashKey('podId', podId)
      .setHashKey('SK', SK)
      .enableUpsert()
      .putAttribute(
        `img_${format}_${size}`,
        `https://yapp-images.s3.amazonaws.com/_${podId}_${SK}_${size}.${format}`
      )
      .execute()
      .then(resolve)
      .fail(err => {
        console.log('error while storing image link', podId, SK, size, format)
        reject(err)
      })
  })
}

const formatData = data =>
  Object.entries(data)
    .filter(([k]) => ['podId', 'SK', 'img'].includes(k))
    .reduce((a, [k, v]) => Object.assign(a, { [k]: v['S'] }), {})

interface Item {
  podId: string
  SK: string
  img: string
}
