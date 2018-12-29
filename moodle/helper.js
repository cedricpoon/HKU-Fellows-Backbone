function parseTicket(data) {
  try {
    const matched = data.match(/ticket=(.*)"/);
    if (matched) {
      return matched[1];
    }
    return null;
  } catch (error) {
    return null;
  }
}

function extractDomainCookies({ domain, cookies }) {
  try {
    const extracted = [];
    cookies.forEach((cookie) => {
      if (cookie.toUpperCase().includes(`Domain=${domain}`.toUpperCase()) || !domain) {
        extracted.push(cookie.split(';')[0].concat('; '));
      }
    });
    return extracted.join('');
  } catch (error) {
    return '';
  }
}

function lookupLoginPattern(chunks) {
  try {
    return chunks.includes('<span class="usertext">');
  } catch (error) {
    return false;
  }
}

module.exports = {
  parseTicket,
  extractDomainCookies,
  lookupLoginPattern,
};
