// Same colors as lerna 😺️
const colors = ['cyan', 'magenta', 'blue', 'yellow', 'green', 'red']
let colorIndex = 0

exports.pickColor = () => colors[colorIndex++ % colors.length]
