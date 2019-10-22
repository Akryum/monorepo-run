const escapeSeqReg = /[-/\\^$*+?.()|[\]{}]/g

exports.escapeAnsiEscapeSeq = (s) => {
  return s.replace(escapeSeqReg, '\\$&')
}
