const path = require('path')
const pty = require('node-pty')
const chalk = require('chalk')
const consola = require('consola')

const children = new Set()

// Same colors as lerna 😺️
const colors = ['cyan', 'magenta', 'blue', 'yellow', 'green', 'red']
let colorIndex = 0

function pickColor () {
  return colors[colorIndex++ % colors.length]
}

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
  const tag = color.bold(`[${path.basename(folder)}]:`)

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

  const promise = new Promise((resolve, reject) => {
    child.on('data', (data) => {
      if (streaming) {
        if (typeof streaming === 'function') {
          streaming(data, folder, script)
        } else if (typeof streaming === 'number') {
          buffer += data
          const now = Date.now()
          if (now - time >= streaming) {
            process.stdout.write(`${tag} ${buffer}\n`)
            buffer = ''
            time = now
          }
        } else {
          process.stdout.write(`${tag} ${data}\n`)
        }
      } else {
        buffer += data
      }
    })

    child.on('exit', (code) => {
      if (!streaming && buffer) {
        process.stdout.write(`${tag}\n${buffer}`)
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
    child.kill()
  }
  children.clear()
}
