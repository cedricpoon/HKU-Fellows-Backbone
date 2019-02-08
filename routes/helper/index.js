const statusMsg = require('../status/messages');

function responseError(code, response) {
  response.json({
    status: code,
    error: statusMsg[`${code}`],
  });
}

function responseSuccess(payload, response, status = 200) {
  response.json({
    status,
    payload,
  });
}

function genericFilter(array, searchKey) {
  return array.filter(obj => Object
    .keys(obj)
    .some(key => obj[key].toUpperCase().includes(searchKey.toUpperCase())));
}

function titleFilter(array, searchKey) {
  return array.filter(obj => obj.title
    .toUpperCase()
    .includes(searchKey.toUpperCase())
    || obj.subtitle
      .toUpperCase()
      .includes(searchKey.toUpperCase()));
}

function sortByTimestamp(a, b) {
  const aTime = new Date(a.timestamp);
  const bTime = new Date(b.timestamp);

  return bTime - aTime;
}

function sortByReplies(a, b) {
  const aTime = new Date(a.replyNo);
  const bTime = new Date(b.replyNo);

  return bTime - aTime;
}

module.exports = {
  responseError,
  responseSuccess,
  sortBy: {
    timestamp: sortByTimestamp,
    replies: sortByReplies,
  },
  filter: {
    generic: genericFilter,
    title: titleFilter,
  },
};
