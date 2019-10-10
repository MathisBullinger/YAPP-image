export default function pipe(v, ...funcs) {
  while (funcs.length) v = funcs.shift()(v)
  return v
}
