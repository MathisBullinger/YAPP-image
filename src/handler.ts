export function image(event, context, callback) {
  console.log('invoked', event.Records.length)
  callback()
}
