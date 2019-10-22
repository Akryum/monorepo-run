const path = require('path')
const pty = require('node-pty')
const chalk = require('chalk')
const consola = require('consola')
const ansiEscapes = require('ansi-escapes')
const { terminate } = require('./util/terminate')
const { hasYarn } = require('./util/env')

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

function escapeAnsiEscapeSeq (s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

/**
 * @param {string} script
 * @param {string[]} folders
 * @param {boolean|number|StreamingCallback} streaming
 */
exports.runScripts = async (script, folders, streaming) => {
  const promises = []

  for (const folder of folders) {
    const { promise } = exports.runScript(script, folder, streaming)
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
 * @param {boolean|number|StreamingCallback} streaming
 * @param {boolean} quiet
 * @param {string} colorCode
 */
exports.runScript = (script, folder, streaming, quiet = false, colorCode = null) => {
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

  let buffer = ''
  let time = Date.now()
  let timeout = null

  const printTag = `\n\n${tag}\n${border}${ansiEscapes.cursorTo(2)}`

  const hasClearLineRef = new RegExp([
    `\r`,
    escapeAnsiEscapeSeq(ansiEscapes.eraseLine),
    escapeAnsiEscapeSeq(ansiEscapes.cursorLeft),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(0)),
    escapeAnsiEscapeSeq(ansiEscapes.cursorTo(1)),
  ].join('|'))

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

  // Process text to print border and move all output 2 charaters to the right

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

  const processOutput = (data) => {
    data = data.replace(regEraseLine, printEraseLine)
    data = data.replace(regMoveCursor, fakePrintBorder)
    data = data.replace(regNewLine, printReplaceNewLine)
    data = data.replace(fakePrintBorderReg, printBorder)
    return data
  }

  const queue = (data) => {
    if (!data.trim()) return
    buffer += data
    const now = Date.now()
    if (now - time >= streaming) {
      flush()
    } else if (!timeout) {
      timeout = setTimeout(flush, streaming)
    }
  }

  const flush = () => {
    print(buffer)
    buffer = ''
    time = Date.now()
    timeout = null
  }

  const promise = new Promise((resolve, reject) => {
    child.on('data', (data) => {
      if (streaming) {
        if (typeof streaming === 'function') {
          streaming(data, folder, script)
        } else if (typeof streaming === 'number') {
          queue(data)
        } else {
          print(data)
        }
      } else {
        buffer += data
      }
    })

    child.on('exit', (code) => {
      if (buffer) {
        if (typeof streaming === 'function') {
          streaming(buffer, folder, script)
        } else {
          print(buffer)
        }
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
