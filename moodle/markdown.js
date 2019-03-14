const TurndownService = require('turndown');
const Showdown = require('showdown');

const turndown = new TurndownService();

const showdown = new Showdown.Converter();

turndown.remove('script');

module.exports = { turndown, showdown };
