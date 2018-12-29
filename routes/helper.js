const statusMsg = require('./statusMsg');

function responseError(code, response) {
  response.json({
    status: code,
    error: statusMsg[`${code}`],
  });
}

function responseSuccess(payload, response) {
  response.json({
    status: (payload.length === 0 ? 204 : 200),
    payload,
  });
}

module.exports = {
  responseError,
  responseSuccess,
};
