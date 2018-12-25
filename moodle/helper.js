function parseTicket(data) {
  const matched = data.match(/ticket=(.*)"/);
  if (matched) {
    return matched[1];
  }
  return null;
}

function extractDomainCookies({ domain, cookies }) {
  const extracted = [];
  cookies.forEach((cookie) => {
    if (cookie.toUpperCase().includes(`Domain=${domain}`.toUpperCase()) || !domain) {
      extracted.push(cookie.split(';')[0].concat('; '));
    }
  });
  return extracted.join('');
}

function lookupLoginPattern(chunks) {
  return chunks.includes('<span class="usertext">');
}

module.exports = {
  parseTicket,
  extractDomainCookies,
  lookupLoginPattern,
};
