#!/usr/bin/env node

const cp = require('child_process')
const path = require('path')
const nodeCleanup = require('node-cleanup')
const ansiEscapes = require('ansi-escapes')
const { terminate } = require('../util/terminate')
const { isLinux } = require('../util/platform')

const child = cp.fork(path.join(__dirname, 'child-mono-run.js'), process.argv.slice(2), {
  stdio: 'inherit',
  cwd: process.cwd(),
  detached: isLinux,
})

nodeCleanup(() => {
  terminate(child, process.cwd())
  // Restore cursor
  process.stdout.write(ansiEscapes.cursorShow)
})
