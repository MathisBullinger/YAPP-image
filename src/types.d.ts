interface StreamKey {
  podId: { S: string }
  SK: { S: string }
}

interface Key {
  podId: string
  SK: string
}

interface Item extends Key {
  [prop: string]: any
}

interface KeyMap {
  [key: string]: string[]
}
