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

  // resize & upload all images to s3
  await Promise.all(
    imgReq.map(({ img: url, podId, SK }) =>
      resize(url).then(imgArr =>
        Promise.all(
          imgArr.map(
            ({ img, size, format }) =>
              new Promise(resolve => {
                img.then(data =>
                  s3
                    .upload({
                      Bucket: 'yapp-images',
                      Key: `${podId}_${SK}_${size}.${format}`,
                      Body: data,
                      ACL: 'public-read',
                    })
                    .promise()
                    .then(resolve)
                )
              })
          )
        )
      )
    )
  )

  return { statusCode: 200 }
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
