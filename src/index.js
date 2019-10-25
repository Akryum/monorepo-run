const path = require('path')
const consola = require('consola')
const { resolvePatterns } = require('./patterns')
const { resolveScriptFolders } = require('./resolve')
const { runScripts } = require('./run')

/**
 * @param {string} script
 * @param {string[]} patterns
 * @param {string} cwd
 * @param {boolean} streaming
 * @param {number} throttle
 * @param {string} ui
 */
exports.monorepoRun = async (script, patterns, cwd, streaming = false, throttle = 0, ui = null) => {
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
    // Simple progress UI

    /** @type {import('tasktree-cli').TaskTree} */
    let tree
    /** @type {import('tasktree-cli/lib/task').Task} */
    let masterTask
    /** @type {Map<string, import('tasktree-cli/lib/task').Task>} */
    let tasks

    if (!streaming) {
      const { TaskTree } = require('tasktree-cli')
      tree = TaskTree.tree()
      tree.start({
        autoClear: true,
      })
      masterTask = tree.add(script)

      // One task per folder
      tasks = new Map()
      for (const folder of folders) {
        const task = masterTask.add(path.relative(process.cwd(), folder))
        tasks.set(folder, task)
      }
    }

    await runScripts(script, folders, streaming, throttle, (folder, status, result) => {
      if (status === 'running' && tree) {
        tasks.get(folder).clear()
      } else if (status === 'error') {
        if (tree) {
          tree.stop()
        }
        consola.error(result)
        exports.killAll()
        process.exit(1)
      } else if (status === 'completed' && tree) {
        tasks.get(folder).complete()
      } else if (status === 'pending' && tree) {
        tasks.get(folder).log('Pending...')
      }
    })

    // Stop progress UI
    if (tree) {
      masterTask.complete()
      tree.stop()
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
