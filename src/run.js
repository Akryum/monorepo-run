const path = require('path')
const pty = require('node-pty')
const chalk = require('chalk')
const consola = require('consola')
const { terminate } = require('./util/terminate')

/** @typedef {import('node-pty').IPty} IPty */

/** @type {Set<IPty>} */
const children = new Set()

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
 * @param {boolean|number|function} streaming
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
 * @param {boolean|number|function} streaming
 */
exports.runScript = (script, folder, streaming) => {
  const color = chalk[pickColor()]
  const tag = color(`⎡⚑ ${path.basename(folder)}`)
  const border = color('⎢')

  const child = pty.spawn('npm', [
    'run',
    script,
  ], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: folder,
    env: process.env,
  })
  children.add(child)

  let buffer = ''
  let time = Date.now()
  let timeout = null

  const print = (data) => {
    if (!data.trim()) return
    const clearingLine = data.includes('\r')
    if (lastOutputClearedLine && (!clearingLine || lastOutputClearedLine !== folder)) {
      process.stdout.write('\n')
    }
    if (lastOutputFolder !== folder) {
      process.stdout.write(`\n${tag}${color(':')} `)
      if (clearingLine) {
        process.stdout.write('\n')
      }
    }
    process.stdout.write(data)
    lastOutputClearedLine = clearingLine ? folder : false
    lastOutputFolder = folder
  }

  const processOutput = (data) => {
    return data.replace(/(\n|\r)/g, `$1${border}`)
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
    print(processOutput(buffer))
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
          print(processOutput(data))
        }
      } else {
        buffer += data
      }
    })

    child.on('exit', (code) => {
      if ((!streaming || code !== 0) && buffer) {
        process.stdout.write(`${tag}\n${border}${processOutput(buffer)}`)
      }
      if (code !== 0) {
        reject(new Error(`${tag} Process exited with code ${code} for script ${script} in ${folder}.`))
      } else {
        resolve()
      }
      children.delete(child)
    })
  })

  return {
    child,
    promise,
  }
}

exports.killAll = () => {
  for (const child of children) {
    terminate(child, process.cwd())
      .then(() => child.kill())
  }
  children.clear()
}
