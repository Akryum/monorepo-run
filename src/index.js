const path = require('path')
const consola = require('consola')
const chalk = require('chalk')
const { resolvePatterns } = require('./patterns')
const { resolveScriptFolders } = require('./resolve')
const { runScripts } = require('./run')

/**
 * @typedef MonorepoRunOptions
 * @prop {string} script
 * @prop {string[]} patterns
 * @prop {string} cwd
 * @prop {number | 'auto'} concurrency
 * @prop {boolean} streaming
 * @prop {number} throttle
 * @prop {string} ui
 */

/**
 * @param {MonorepoRunOptions} options
 */
exports.monorepoRun = async ({
  script,
  patterns,
  cwd,
  concurrency = null,
  streaming = false,
  throttle = 0,
  ui = null,
}) => {
  if (!cwd) {
    cwd = process.cwd()
  }
  if (!patterns) {
    patterns = resolvePatterns(cwd)
  }
  if (!patterns.length) {
    consola.error(`'patterns' is empty.`)
    return {
      folders: [],
    }
  }

  const folders = resolveScriptFolders(script, patterns)

  if (concurrency === null) {
    concurrency = folders.length
  } else if (concurrency === 'auto') {
    const os = require('os')
    concurrency = os.cpus().length
    consola.log(`Concurrency automatically set to ${chalk.bold(concurrency)}`)
  }
  concurrency = Math.min(folders.length, concurrency)

  if (ui) {
    const { startUI } = require('./ui')
    await startUI({ script, folders, layout: ui, concurrency })
  } else {
    // Simple progress UI

    let spinner, spinnerLabels

    if (!streaming) {
      const Multispinner = require('multispinner')

      // One task per folder
      spinnerLabels = {}
      for (const folder of folders) {
        const label = path.relative(process.cwd(), folder)
        spinnerLabels[folder] = label
      }

      spinner = new Multispinner(spinnerLabels, {
        clear: true,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      })
      spinner.stop = function () {
        if (this.clear) this.update.clear()
        this.update.done()
      }.bind(spinner)
    }

    await runScripts({
      script,
      folders,
      streaming,
      throttle,
      concurrency,
    }, (folder, status, result) => {
      if (status === 'running' && spinner) {
        spinner.spinners[folder].text = spinnerLabels[folder]
      } else if (status === 'error') {
        if (spinner) {
          spinner.stop()
        }
        consola.error(result)
        exports.killAll()
        process.exit(1)
      } else if (status === 'completed' && spinner) {
        spinner.success(folder)
      } else if (status === 'pending' && spinner) {
        spinner.spinners[folder].text = `${spinnerLabels[folder]} (💤️ Pending)`
      }
    })

    if (spinner) {
      spinner.stop()
    }
  }

  return {
    folders,
  }
}

Object.assign(module.exports, {
  ...require('./patterns'),
  ...require('./resolve'),
  ...require('./run'),
})
