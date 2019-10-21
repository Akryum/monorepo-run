const consola = require('consola')
const { resolvePatterns } = require('./patterns')
const { resolveScriptFolders } = require('./resolve')
const { runScripts } = require('./run')

/**
 * @param {string} script
 * @param {string[]} patterns
 * @param {string} cwd
 * @param {boolean} streaming
 */
exports.monorepoRun = async (script, patterns, cwd, streaming = false) => {
  if (!cwd) {
    cwd = process.cwd()
  }
  if (!patterns) {
    patterns = resolvePatterns(cwd)
  }
  if (!patterns.length) {
    consola.error(`'patterns' is empty.`)
    return false
  }

  const folders = resolveScriptFolders(script, patterns)

  await runScripts(script, folders, streaming)

  return {
    folders,
  }
}

Object.assign(module.exports, {
  ...require('./patterns'),
  ...require('./resolve'),
  ...require('./run'),
})
