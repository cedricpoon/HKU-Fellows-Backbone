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

module.exports = {
  responseError,
  responseSuccess,
};
