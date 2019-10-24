const blessed = require('neo-blessed')
const path = require('path')
const chalk = require('chalk')
const consola = require('consola')
const { runScript, killAll } = require('../run')
const { create: createToolbar } = require('./toobar')
const { terminate } = require('../util/terminate')
const { stripAnsiEscapeSeqs, countEraseLineEscapeSeqs } = require('../util/ansi')
const { throttle } = require('../util/throttle')

/**
 * @param {string} script
 * @param {string[]} folders
 * @param {boolean|number} streaming
 * @param {string} layout
 */
exports.startUI = (script, folders, streaming, layout) => {
  return new Promise((resolve) => {
    // @TODO refactor help
    consola.info('Keyboard shortcuts: Arrows to select task | [SPACE] to kill task or start again')

    // Items

    function applyProcess (item) {
      let eraseLineEscapeSeqsCount = 0

      const streamingCallback = (data) => {
        eraseLineEscapeSeqsCount = countEraseLineEscapeSeqs(data)
        if (eraseLineEscapeSeqsCount) {
          for (let i = 0; i < eraseLineEscapeSeqsCount; i++) {
            item.log.popLine()
          }
        }
        data = stripAnsiEscapeSeqs(data)
        item.log.add(data)
        update()
      }

      Object.assign(item, runScript(script, item.folder, streamingCallback, 200, true))

      item.promise.catch(e => {
        item.status = 'error'
        update()
      })

      item.child.on('exit', (code) => {
        if (item.status === 'killed') return
        if (code === 0) {
          item.status = 'completed'
        } else {
          item.status = 'error'
        }
        update()
      })
    }

    const items = folders.map(folder => {
      const item = {
        folder,
        status: 'running',
        child: null,
        promise: null,
        colorCode: null,
        color: null,
        __label: null,
        __status: null,
        __selected: null,
      }
      applyProcess(item)
      item.label = item.color(path.basename(item.folder))
      return item
    })

    function stopItem (item) {
      item.status = 'killed'
      item.child.kill()
      update()
    }

    function startItem (item) {
      applyProcess(item)
      item.status = 'running'
      update()
    }

    let selectedIndex = 0

    // Layout

    const screen = blessed.screen({
      smartCSR: true,
      autoPadding: true,
      fullUnicode: true,
    })

    process.on('SIGWINCH', () => {
      screen.emit('resize')
      update()
    })

    screen.key(['escape', 'q'], () => {
      if (items.every(i => i.status !== 'running')) {
        resolve()
      }
    })

    screen.key('C-c', () => {
      killAll()
      terminate(process.pid, process.cwd())
      resolve()
    })

    screen.key(['left', 'up'], () => {
      selectedIndex--
      if (selectedIndex < 0) {
        selectedIndex = items.length - 1
      }
      update()
    })

    screen.key(['right', 'down'], () => {
      selectedIndex++
      if (selectedIndex >= items.length) {
        selectedIndex = 0
      }
      update()
    })

    screen.key(['space'], () => {
      const selectedItem = items[selectedIndex]

      if (selectedItem.status === 'running') {
        stopItem(selectedItem)
      } else {
        startItem(selectedItem)
      }
    })

    const { create } = require(`./layouts/${layout}`)
    create(screen, items)
    createToolbar(screen, items)

    for (const item of items) {
      item.child.resize(item.log.width - 2, item.log.height)
    }

    const update = throttle(() => {
      const selectedItem = items[selectedIndex]

      for (const item of items) {
        const selected = item === selectedItem
        if (item.__label !== item.label ||
          item.__status !== item.status ||
          item.__selected !== selected) {
          item.__label = item.label
          item.__status = item.status
          item.__selected = selected

          item.log.setLabel(
            item.color(selected ? ' ◉ ' : ' ○ ') +
            item.label + ' ' +
            (item.status === 'running' ? '⏳'
              : item.status === 'completed' ? chalk.green('✓')
                : item.status === 'error' ? chalk.red('⚠')
                  : item.status === 'killed' ? chalk.gray('⊗')
                    : '') + ' '
          )
        }
      }

      screen.render()
    }, 30)

    update()
  })
}
