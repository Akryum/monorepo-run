const consola = require('consola')
const { resolvePatterns } = require('./patterns')
const { resolveScriptFolders } = require('./resolve')
const { runScripts } = require('./run')

/**
 * @param {string} script
 * @param {string[]} patterns
 * @param {string} cwd
 * @param {boolean} streaming
 * @param {string} ui
 */
exports.monorepoRun = async (script, patterns, cwd, streaming = false, ui = null) => {
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

  if (ui) {
    const { startUI } = require('./ui')
    await startUI(script, folders, streaming, ui)
  } else {
    await runScripts(script, folders, streaming)
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
