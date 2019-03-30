const bodyMaxLength = 400;

// escape all (') and (") character
function addSlashes(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

function noNewline(s) {
  return s.replace(/[\b\n\r\t]/g, ' ');
}

function limit(s) {
  try {
    if (s.length > bodyMaxLength) {
      return `${s.substring(0, bodyMaxLength)} ...`;
    }
  } catch (e) { /* do nothing */ }
  return s;
}

module.exports = { addSlashes, limit, noNewline };
