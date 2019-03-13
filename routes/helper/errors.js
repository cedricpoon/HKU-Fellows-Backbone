module.exports = (error, response) => {
  const { responseError } = require('./index'); //eslint-disable-line
  switch (error.message) {
    case 'loginMoodle-err2':
      responseError(400, response);
      break;
    case 'login-error':
      responseError(401, response);
      break;
    case 'unauthenticated':
      responseError(401, response);
      break;
    case 'inaccessible':
      responseError(403, response);
      break;
    case 'moodle-no-default-forum':
      responseError(404, response);
      break;
    case 'moodle-post-not-created':
      responseError(406, response);
      break;
    case 'moodle-key-timeout':
      responseError(408, response);
      break;
    case 'entry-exist-error':
      responseError(409, response);
      break;
    case 'self-voting-error':
      responseError(410, response);
      break;
    case 'moodle-not-enrolled':
      responseError(412, response);
      break;
    case 'crawling-error':
      responseError(421, response);
      break;
    case 'loginMoodle-err1':
      responseError(421, response);
      break;
    case 'database-error':
      responseError(502, response);
      break;
    default:
      responseError(500, response);
  }
};
