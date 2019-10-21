const path = require('path')
const fs = require('fs')

/**
 * @returns {string[]}
 */
exports.resolvePatterns = (cwd) => {
  const pkgFile = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, { encoding: 'utf8' }))
      if (pkg.workspaces) {
        return pkg.workspaces
      }
    } catch (e) {
      // Error
    }
  }
  return []
}
