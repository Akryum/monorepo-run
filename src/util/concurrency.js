/**
 * @param {string[]} folders
 * @param {number} concurrency
 * @param {(folder: string, next: (() => void)) => void} runCallback
 */
exports.concurrent = (folders, concurrency, runCallback) => {
  const queue = folders.slice()
  /**
   * Available "slots" to run a task
   */
  let coins = concurrency

  const run = (folder) => {
    runCallback(folder, () => {
      coins++
      runNext()
    })
  }

  const runNext = () => {
    if (coins > 0 && queue.length) {
      coins--
      run(queue.shift())
      return true
    }
    return false
  }

  return {
    initRun: runNext,
  }
}
