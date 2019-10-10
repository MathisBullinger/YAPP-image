const fs = require('fs')

function constructOverload(n) {
  const str = `export default function pipe<${Array(n + 1)
    .fill()
    .map((v, i) => `T${i}`)
    .join(', ')}>
      (
        v: T0,
        ${Array(n)
          .fill()
          .map((v, i) => `f${i}: (v: T${i}) => T${i + 1}`)
          .join(',\n')}
      ): ${`T${n}`}`
  return str
}

if (!fs.readFileSync('./src/pipe.ts').includes('<')) {
  const str = Array(10)
    .fill()
    .map((v, i) => constructOverload(i))
    .join('\n\n')

  fs.writeFileSync(
    './src/pipe.ts',
    str + '\n\n' + fs.readFileSync('./src/pipe.ts')
  )
}
