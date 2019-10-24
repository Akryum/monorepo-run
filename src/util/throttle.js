exports.throttle = (fn, delay) => {
  if (delay <= 0) {
    return fn
  }

  let time = Date.now()
  let timeout
  let lastArgs

  const call = () => {
    time = Date.now()
    timeout = null
    fn(...lastArgs)
  }

  return (...args) => {
    lastArgs = args
    const now = Date.now()
    if (now - time >= delay) {
      call()
    } else if (!timeout) {
      timeout = setTimeout(call, delay)
    }
  }
}
