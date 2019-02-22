const TurndownService = require('turndown');

const turndown = new TurndownService();

turndown.remove('script');

module.exports = { turndown };
