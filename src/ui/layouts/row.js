const blessed = require('neo-blessed')

exports.create = (screen, items) => {
  const colSize = 1 / items.length * 100
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const log = blessed.log({
      top: '0',
      left: colSize * i + '%',
      width: colSize + '%',
      height: '100%',
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
}
