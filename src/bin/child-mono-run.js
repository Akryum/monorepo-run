#!/usr/bin/env node

const { cac } = require('cac')
const { monorepoRun } = require('../')
const consola = require('consola')
const chalk = require('chalk')
const pkg = require('../../package.json')

const cli = cac()

cli.option('--patterns <patterns>', 'Folder glob patterns (by default will take yarn workspaces)')

cli.option('--stream [throttle]', 'Stream output directly instead of waiting for the end. You can also throttle (ms) the output when streaming is enabled.', {
  default: false,
})

cli.option('--ui [layout]', 'Display a grid UI with interactive actions. Layout can be: row, column', {
  default: false,
})

cli.help()
cli.version(pkg.version)

cli.command('<script>', 'Run a script in the monorepo packages')
  .action(async (script, options) => {
    if (options.stream && !isNaN(parseInt(options.stream))) {
      options.stream = parseInt(options.stream)
    }
    if (options.patterns) {
      if (options.patterns.startsWith('[')) {
        options.patterns = JSON.parse(options.patterns)
      } else {
        options.patterns = options.patterns.split(',')
      }
    }
    if (options.ui && typeof options.ui !== 'string') {
      options.ui = 'row'
    }
    try {
      const time = Date.now()
      const { folders } = await monorepoRun(script, options.patterns, null, options.stream, options.ui)

      // Summary
      console.log('\n')
      consola.success(`Completed ${chalk.bold(script)} (${Math.round((Date.now() - time) / 10) / 100}s) in:`)
      consola.log(chalk.green(folders.map(f => `  - ${f}`).join('\n')))

      process.exit()
    } catch (e) {
      consola.error(e)
      process.exit(1)
    }
  })

cli.parse()
