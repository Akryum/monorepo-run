const path = require('path')
const fs = require('fs')

// From https://github.com/microsoft/vscode/blob/c0c9ea27d6e8d660d8716d7acee82cf3c00fa3e5/src/vs/workbench/parts/tasks/electron-browser/terminalTaskSystem.ts#L691

exports.findExecutable = (command, cwd, options) => {
  // If we have an absolute path then we take it.
  if (path.isAbsolute(command)) {
    return command
  }
  let dir = path.dirname(command)
  if (dir !== '.') {
    // We have a directory and the directory is relative (see above). Make the path absolute
    // to the current working directory.
    return path.join(cwd, command)
  }
  let paths
  // The options can override the PATH. So consider that PATH if present.
  if (options && options.env) {
    // Path can be named in many different ways and for the execution it doesn't matter
    for (let key of Object.keys(options.env)) {
      if (key.toLowerCase() === 'path') {
        if (typeof options.env[key] === 'string') {
          paths = options.env[key].split(path.delimiter)
        }
        break
      }
    }
  }
  if (paths === void 0 && typeof process.env.PATH === 'string') {
    paths = process.env.PATH.split(path.delimiter)
  }
  // No PATH environment. Make path absolute to the cwd.
  if (paths === void 0 || paths.length === 0) {
    return path.join(cwd, command)
  }
  // We have a simple file name. We get the path variable from the env
  // and try to find the executable on the path.
  for (let pathEntry of paths) {
    // The path entry is absolute.
    let fullPath
    if (path.isAbsolute(pathEntry)) {
      fullPath = path.join(pathEntry, command)
    } else {
      fullPath = path.join(cwd, pathEntry, command)
    }
    if (fs.existsSync(fullPath)) {
      const fullPathWithCmd = `${fullPath}.cmd`
      return fs.existsSync(fullPathWithCmd) ? fullPathWithCmd : fullPath
    }
    let withExtension = fullPath + '.com'
    if (fs.existsSync(withExtension)) {
      return withExtension
    }
    withExtension = fullPath + '.exe'
    if (fs.existsSync(withExtension)) {
      return withExtension
    }
  }
  return path.join(cwd, command)
}
