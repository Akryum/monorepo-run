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

    /** @type {import('tasktree-cli').TaskTree} */
    let tree
    /** @type {import('tasktree-cli/lib/task').Task} */
    let masterTask
    /** @type {Map<string, { label: string, task: import('tasktree-cli/lib/task').Task }>} */
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
        const label = path.relative(process.cwd(), folder)
        const task = masterTask.add(label)
        tasks.set(folder, { label, task })
      }
    }

    await runScripts({
      script,
      folders,
      streaming,
      throttle,
      concurrency,
    }, (folder, status, result) => {
      const task = tree ? tasks.get(folder) : null
      if (status === 'running' && task) {
        task.task.update(task.label)
      } else if (status === 'error') {
        if (tree) {
          tree.stop()
        }
        consola.error(result)
        exports.killAll()
        process.exit(1)
      } else if (status === 'completed' && task) {
        task.task.complete()
      } else if (status === 'pending' && task) {
        task.task.update(`${task.label} (💤️ Pending)`)
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
