// const blessed = require('neo-blessed')

exports.create = (screen, items) => {
  // const help = blessed.box({
  //   height: 1,
  //   content: `Arrows to select shell | [SPACE] to kill or start again`,
  //   border: {
  //     fg: 'green',
  //   },
  // })
  // screen.append(help)

  function refresh ({
    items,
    selectedItem,
  }) {

  }

  return {
    refresh,
  }
}
