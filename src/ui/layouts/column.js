const blessed = require('neo-blessed')

exports.create = (screen, items) => {
  const colSize = 1 / items.length * 100
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const log = blessed.log({
      top: colSize * i + '%',
      left: '0',
      width: '100%',
      height: colSize + '%',
      border: {
        type: 'line',
        fg: item.colorCode,
      },
      scrollable: true,
      scrollbar: {
        bg: item.colorCode,
      },
      mouse: true,
    })
    screen.append(log)
    item.log = log
  }

  function refresh ({
    items,
    selectedItem,
  }) {

  }

  return {
    refresh,
  }
}
