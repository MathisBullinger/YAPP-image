import dbClient from './dynamodb'

export const image = async event => {
  // get newly inserted items
  const items: Item[] = event.Records.filter(
    ({ eventName }) => eventName === 'INSERT'
  ).map(event => formatData(event.dynamodb.NewImage))
  if (items.length === 0) return { statusCode: 200 }

  // bundle by podId
  const podcasts: { [key: string]: Item[] } = items.reduce(
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
    .map(([podId]) => ({ podId, SK: 'meta' }))

  if (metaQueries.length) {
    const { result } = await dbClient
      .newBatchGetBuilder()
      .requestItems('podcasts', metaQueries)
      .execute()
    result.podcasts.forEach(meta => podcasts[meta.podId].push(meta))
  }

  return { statusCode: 200 }
}

const formatData = data =>
  Object.entries(data)
    .filter(([k]) => ['podId', 'SK', 'img'].includes(k))
    .reduce((a, [k, v]) => Object.assign(a, { [k]: v['S'] }), {})

interface Item {
  podId: string
  SK: string
}
