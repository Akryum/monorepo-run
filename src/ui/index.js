const blessed = require('neo-blessed')
const path = require('path')
const chalk = require('chalk')
const { runScript, killAll } = require('../run')
const { create: createToolbar } = require('./toobar')
const { terminate } = require('../util/terminate')

/**
 * @param {string} script
 * @param {string[]} folders
 * @param {boolean|number} streaming
 * @param {string} layout
 */
exports.startUI = (script, folders, streaming, layout) => {
  return new Promise((resolve) => {
    // Items

    function applyProcess (item) {
      Object.assign(item, runScript(script, item.folder, (data) => {
        item.log.add(data)
        update()
      }, true))

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
    const {
      refresh: refreshLayout,
    } = create(screen, items)
    const {
      refresh: refreshToolbar,
    } = createToolbar(screen, items)

    for (const item of items) {
      item.child.resize(item.log.width - 2, item.log.height)
    }

    const update = () => {
      const selectedItem = items[selectedIndex]

      for (const item of items) {
        item.log.setLabel(
          item.color(item === selectedItem ? ' ◉ ' : ' ○ ') +
          item.label + ' ' +
          (item.status === 'running' ? '⏳'
            : item.status === 'completed' ? chalk.green('✓')
              : item.status === 'error' ? chalk.red('⚠')
                : item.status === 'killed' ? chalk.gray('⊗')
                  : '') + ' '
        )
      }

      refreshLayout({
        items,
        selectedItem,
      })

      refreshToolbar({
        items,
        selectedItem,
      })

      screen.render()
    }

    update()
  })
}
