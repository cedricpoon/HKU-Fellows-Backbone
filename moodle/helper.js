const cheerio = require('cheerio');
const { turndown } = require('./markdown');
const { moodleDomain, moodlePluginFile } = require('./urls');

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

function extractSlug(innerHTML) {
  try {
    const a = innerHTML.split('_');
    return a[0].length === 0 ? a[1] : a[0];
  } catch (error) {
    return '';
  }
}

function standardizePost(content) {
  const $ = cheerio.load(content, { decodeEntities: false });
  // replace img to hyperlink
  $(`img[src*="${moodleDomain}${moodlePluginFile}"]`).each((i, elem) => {
    $(elem).replaceWith($(`<a href="${$(elem).attr('src')}">[Attached Image]</a>`));
  });
  // replace video to hyperlink
  $(`video > source[src*="${moodleDomain}${moodlePluginFile}"]`).each((i, elem) => {
    $(elem).parent().replaceWith($(`<a href="${$(elem).attr('src')}">[Attached Video]</a>`));
  });
  return turndown.turndown($.html());
}

module.exports = {
  parseTicket,
  extractDomainCookies,
  lookupLoginPattern,
  extractSlug,
  standardizePost,
};
