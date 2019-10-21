const globby = require('globby')
const fs = require('fs')
const path = require('path')
const consola = require('consola')

/**
 * Resolves paths to the folders where the script can be run.
 * @param {string} script
 * @param {string[]} patterns
 * @param {string} cwd
 */
exports.resolveScriptFolders = (script, patterns, cwd) => {
  /** @type {string[]} */
  const result = []

  /** @type {import('globby').GlobbyOptions} */
  const globbyOptions = {
    cwd,
    absolute: true,
    followSymlinkedDirectories: false,
    onlyFiles: true,
    // POSIX results always need to be normalized
    transform: p => path.normalize(p),
  }

  if (patterns.some(p => p.indexOf('**') > -1)) {
    if (patterns.some(p => p.indexOf('node_modules') > -1)) {
      throw new Error('An explicit node_modules package path does not allow globstars (**)')
    }

    globbyOptions.ignore = [
      // allow globs like "packages/**",
      // but avoid picking up node_modules/**/package.json
      '**/node_modules/**',
    ]
  }

  patterns.sort()

  for (const pattern of patterns) {
    const pkgFiles = globby.sync(path.join(pattern, 'package.json'), globbyOptions)

    for (const pkgFile of pkgFiles) {
      if (fs.existsSync(pkgFile)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgFile, { encoding: 'utf8' }))
          if (pkg.scripts && pkg.scripts[script]) {
            result.push(path.dirname(pkgFile))
          }
        } catch (e) {
          consola.error(`Can't parse ${pkgFile}`)
        }
      }
    }
  }

  result.sort()

  return result
}
