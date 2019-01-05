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

function sortByTimestamp(a, b) {
  const aTime = new Date(a.timestamp);
  const bTime = new Date(b.timestamp);

  return bTime - aTime;
}

module.exports = {
  responseError,
  responseSuccess,
  sortByTimestamp,
};
