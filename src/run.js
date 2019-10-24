const path = require('path')
const pty = require('node-pty')
const chalk = require('chalk')
const consola = require('consola')
const ansiEscapes = require('ansi-escapes')
const { terminate } = require('./util/terminate')
const { hasYarn } = require('./util/env')
const { escapeAnsiEscapeSeq, countEraseLineEscapeSeqs } = require('./util/ansi')
const { throttle: applyThrottle } = require('./util/throttle')

/** @typedef {import('node-pty').IPty} IPty */

/** @typedef {(data: string, folder: string, script: string) => void} StreamingCallback */

/** @type {Set<IPty>} */
const children = new Set()

/** @type {Map<string, IPty>} */
const folderMap = new Map()
exports.folderMap = folderMap

// Same colors as lerna 😺️
const colors = ['cyan', 'magenta', 'blue', 'yellow', 'green', 'red']
let colorIndex = 0

function pickColor () {
  return colors[colorIndex++ % colors.length]
}

let lastOutputClearedLine = false
let lastOutputFolder = null

/**
 * @param {string} script
 * @param {string[]} folders
 * @param {boolean|StreamingCallback} streaming
 * @param {throttle} throttle
 */
exports.runScripts = async (script, folders, streaming = false, throttle = 0) => {
  const promises = []

  for (const folder of folders) {
    const { promise } = exports.runScript(script, folder, streaming, throttle)
    promises.push(promise)
    promise.catch(e => {
      consola.error(e)
      exports.killAll()
      process.exit(1)
    })
  }

  return Promise.all(promises)
}

/**
 * @param {string} script
 * @param {string} folder
 * @param {boolean|StreamingCallback} streaming
 * @param {throttle} throttle
 * @param {boolean} quiet
 * @param {string} colorCode
 */
exports.runScript = (script, folder, streaming = false, throttle = 0, quiet = false, colorCode = null) => {
  const streamingEnabled = !!streaming

  if (!colorCode) {
    colorCode = pickColor()
  }
  const color = chalk[colorCode]
  const tag = color(`⎡⚑ ${path.basename(folder)}`)
  const border = color('⎢')

  const child = pty.spawn(hasYarn() ? 'yarn' : 'npm', [
    'run',
    script,
  ], {
    name: 'xterm-color',
    cols: process.stdout.columns - 2,
    rows: process.stdout.rows,
    cwd: folder,
    env: process.env,
  })
  children.add(child)
  folderMap.set(folder, child)

  const printTag = `\n\n${tag}\n${border}${ansiEscapes.cursorTo(2)}`

  const hasClearLineRef = new RegExp([
    `\r`,
    escapeAnsiEscapeSeq(ansiEscapes.eraseLine),
    escapeAnsiEscapeSeq(ansiEscapes.cursorLeft),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(0)),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(1)),
  ].join('|'))

  /**
   * Print a data chunk to stdout
   * @param {string} data
   */
  const print = (data) => {
    if (quiet || !data.trim()) return
    const clearingLine = hasClearLineRef.test(data)
    data = processOutput(data)
    if (lastOutputFolder !== folder) {
      if (lastOutputClearedLine) {
        process.stdout.write(ansiEscapes.eraseLine)
        process.stdout.write(ansiEscapes.cursorTo(0))
      }
      // Different folder => print folder tag
      process.stdout.write(printTag)
      if (clearingLine) {
        process.stdout.write('\n')
      }
    }

    process.stdout.write(data)
    lastOutputClearedLine = clearingLine ? folder : false
    lastOutputFolder = folder
  }

  // Data chunk processing

  const regEraseLine = new RegExp(escapeAnsiEscapeSeq(ansiEscapes.eraseLine), 'g')
  const regMoveCursor = new RegExp(`(${[
    '\r',
    escapeAnsiEscapeSeq(ansiEscapes.cursorLeft),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(0)),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(1)),
  ].join('|')})+`, 'g')
  const regNewLine = /(\n)/g
  const fakePrintBorder = '__print_border__'
  const fakePrintBorderReg = new RegExp(fakePrintBorder, 'g')
  const printBorder = `${ansiEscapes.cursorTo(0)}${border}${ansiEscapes.cursorTo(2)}`
  const printEraseLine = `${ansiEscapes.eraseLine}${fakePrintBorder}`
  const printReplaceNewLine = `$&${fakePrintBorder}`

  /**
   * Process text to print border and move all output 2 charaters to the right
   * @param {string} data
   */
  const processOutput = (data) => {
    data = data.replace(regEraseLine, printEraseLine)
    data = data.replace(regMoveCursor, fakePrintBorder)
    data = data.replace(regNewLine, printReplaceNewLine)
    data = data.replace(fakePrintBorderReg, printBorder)
    return data
  }

  /**
   * Send the pending streaming data to the screen or
   * the streaming callback
   * @type {(data: string) => void}
   */
  let outputData
  if (typeof streaming === 'function') {
    outputData = (data) => {
      streaming(data, folder, script)
    }
  } else {
    outputData = print
  }

  let buffer = []

  /**
   * Flush the queued data
   */
  const flushQueuedData = applyThrottle(() => {
    outputData(buffer.join(''))
    buffer.length = 0
  }, throttle)

  let eraseLineEscapeSeqsCount = 0

  /**
   * Queue a streaming print data
   */
  const queueData = (data) => {
    if (!data.trim()) return
    eraseLineEscapeSeqsCount = countEraseLineEscapeSeqs(data)
    if (eraseLineEscapeSeqsCount) {
      buffer = buffer.slice(0, buffer.length - eraseLineEscapeSeqsCount)
    }
    buffer.push(data)
    flushQueuedData()
  }

  // Child process events

  const promise = new Promise((resolve, reject) => {
    child.on('data', (data) => {
      if (streamingEnabled) {
        queueData(data)
      } else {
        buffer.push(data)
      }
    })

    child.on('exit', (code) => {
      if (buffer) {
        flushQueuedData()
      }
      if (code !== 0) {
        reject(new Error(`${color(path.basename(folder))} Process exited with code ${code} for script ${chalk.bold(script)} in ${folder}.`))
      } else {
        resolve()
      }
      children.delete(child)
      folderMap.delete(folder)
    })
  })

  return {
    child,
    promise,
    colorCode,
    color,
  }
}

exports.killAll = () => {
  for (const child of children) {
    terminate(child, process.cwd())
    child.kill()
  }
  children.clear()
  folderMap.clear()
}
