const ansiEscapes = require('ansi-escapes')

const ESC = '\u001B['

const escapeSeqReg = /[-/\\^$*+?.()|[\]{}]/g

exports.escapeAnsiEscapeSeq = (s) => {
  return s.replace(escapeSeqReg, '\\$&')
}

const ansiEscapeSeqsReg = new RegExp([
  ansiEscapes.clearScreen,
  ansiEscapes.eraseLine,
  ansiEscapes.eraseStartLine,
  ansiEscapes.eraseEndLine,
  `${ESC}0K`,
  ...(genSeq(ansiEscapes.cursorTo, 0, 10)),
  ...(genSeq2(ansiEscapes.cursorTo, 0, 10, 0, 10)),
  ...(genSeq(ansiEscapes.cursorMove, -10, 10)),
  ...(genSeq2(ansiEscapes.cursorMove, -10, 10, -10, 10)),
  ...(genSeq(ansiEscapes.cursorUp, -10, 10)),
  ...(genSeq(ansiEscapes.cursorDown, -10, 10)),
  ...(genSeq(ansiEscapes.cursorForward, -10, 10)),
  ...(genSeq(ansiEscapes.cursorBackward, -10, 10)),
].map(e => `(${exports.escapeAnsiEscapeSeq(e)})`).join('|'), 'g')

exports.stripAnsiEscapeSeqs = (s) => {
  s = s.replace(ansiEscapeSeqsReg, '')
  s = s.replace(/\n/g, '')
  return s
}

const eraseLineEscapeSeqsReg = new RegExp([
  ansiEscapes.eraseLine,
  ansiEscapes.eraseStartLine,
  ansiEscapes.eraseEndLine,
  `${ESC}0K`,
  ...(genSeq(ansiEscapes.cursorTo, 0, 10)),
].map(e => `(${exports.escapeAnsiEscapeSeq(e)})`).join('|'), 'g')

exports.hasEraseLineEscapeSeq = (s) => {
  return eraseLineEscapeSeqsReg.test(s)
}

function genSeq (fn, from, to) {
  const result = []
  for (let i = from; i <= to; i++) {
    result.push(fn(i))
  }
  return result
}

function genSeq2 (fn, from, to, from2, to2) {
  const result = []
  for (let i = from; i <= to; i++) {
    for (let j = from2; j <= to2; j++) {
      result.push(fn(i, j))
    }
  }
  return result
}
