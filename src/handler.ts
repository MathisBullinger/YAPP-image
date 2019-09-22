export const image = async (event, context) => {
  const newItems = event.Records.filter(
    ({ eventName }) => eventName === 'INSERT'
  ).map(event => event.dynamodb.NewImage)

  console.log(newItems.length, 'new items')
  newItems.forEach(console.dir)

  return { statusCode: 200 }
}
