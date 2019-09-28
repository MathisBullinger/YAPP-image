import * as db from './dynamodb'
import { S3, DynamoDBStreams as Stream } from 'aws-sdk'
import { resize } from './image'
import pipe from './pipe'
import axios from 'axios'

const s3 = new S3()

const EPI_SIZES = [64, 128, 256, 512]
const POD_SIZES = [...EPI_SIZES, 1024]

export const image = async event => {
  const streamKeys = pipe(
    event.Records,
    filterEventType('INSERT'),
    getRecordKeys
  )

  if (streamKeys.length === 0) return

  const keys = pipe(
    streamKeys,
    keysByPodcast,
    completeMetaKeys,
    flattenKeyMap
  )

  const items = await db.batchGet(keys)

  const imgRequests = getImgRequests(items, streamKeys)

  log(items, imgRequests)

  const processItem = ({ img: url, podId, SK, sizes }: typeof imgRequests[0]) =>
    downloadImage(url).then(data =>
      resize(data, sizes).then(resProms =>
        resProms.map(resProm =>
          resizeImg(resProm).then(({ img, size, format }) =>
            Promise.all([
              upload(`${podId}_${SK}_${size}.${format}`, img),
              storeImgLink(podId, SK, size, format),
            ])
          )
        )
      )
    )

  await Promise.all(
    imgRequests.map(item =>
      processItem(item).catch(err => {
        console.warn(`item ${item.title || item.name} failed`)
        console.log(err)
      })
    )
  )
}

const keysByPodcast = (keys: Key[]): KeyMap =>
  keys.reduce(
    (a, c) => ({
      ...a,
      ...(c.podId in a
        ? { [c.podId]: [...a[c.podId], c.SK] }
        : { [c.podId]: [c.SK] }),
    }),
    {}
  )

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
        console.log(`error uploading ${name}`)
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
      [`img_${format}_${size}`]: `https://yapp-images.s3.amazonaws.com/${podId}_${SK}_${size}.${format}`,
    }
  )

const filterEventType = (type: Stream.OperationType) => (
  records: Stream.Record[]
) => records.filter(({ eventName }) => eventName === type)

const formatStreamKeys = (keys: StreamKey[]): Key[] =>
  keys.map(({ podId, SK }) => ({
    podId: podId.S,
    SK: SK.S,
  }))

const getRecordKeys = (records: Stream.Record[]): Key[] =>
  formatStreamKeys(
    records.map(record => (<unknown>record.dynamodb.Keys) as StreamKey)
  )

const flattenKeyMap = (keys: KeyMap): Key[] =>
  Object.entries(keys)
    .map(([k, v]) => v.map(v => ({ podId: k, SK: v })))
    .flat()

const completeMetaKeys = (keys: KeyMap): KeyMap =>
  Object.fromEntries(
    Object.entries(keys).map(([id, SK]) => [
      id,
      SK.includes('meta') ? SK : [...SK, 'meta'],
    ])
  )

function log(items: Item[], requests: Item[]) {
  items.forEach(it =>
    console.log(
      `${
        requests.find(({ podId, SK }) => podId === it.podId && SK === it.SK)
          ? 'add '
          : 'skip'
      } ${it.title || it.name}`
    )
  )
}

const getImgRequests = (
  items: Item[],
  streamKeys: Key[]
): (Item & { sizes: number[] })[] =>
  items
    .filter(
      item =>
        item.img &&
        ((item.SK === 'meta' &&
          streamKeys.find(
            ({ podId, SK }) => podId === item.podId && SK === 'meta'
          )) ||
          items.find(({ podId, SK }) => podId === item.podId && SK === 'meta')
            .img !== item.img)
    )
    .map(item => ({
      ...item,
      sizes: (item.SK === 'meta' ? POD_SIZES : EPI_SIZES).filter(
        size =>
          !Object.keys(item).find(
            key => key.startsWith('size') && key.endsWith(size.toString())
          )
      ),
    }))
    .filter(({ sizes }) => sizes.length > 0)

const downloadImage = (url: string): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    axios({
      method: 'get',
      url,
      responseType: 'arraybuffer',
      timeout: 10000,
    })
      .then(({ data }) => resolve(data))
      .catch(err => {
        console.log(`error while downloading ${url}`)
        reject(err)
      })
  )

function promiseTimeout<T>(promise: Promise<T>, time: number): Promise<T> {
  return new Promise((res, rej) => {
    const timeout = setTimeout(() => rej('timeout'), time)
    promise
      .then(data => {
        clearTimeout(timeout)
        res(data)
      })
      .catch(err => {
        clearTimeout(timeout)
        rej(err)
      })
  })
}

const resizeImg = (
  img: Promise<{ img: Buffer; size: number; format: string }>
): typeof img =>
  new Promise((res, rej) => {
    promiseTimeout(img, 15000)
      .then(res)
      .catch(err => {
        if (err === 'timeout') console.warn(`timeout while resizing`)
        rej(err)
      })
  })
