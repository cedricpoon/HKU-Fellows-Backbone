const statusMsg = require('../status/messages');
const handleError = require('./errors');
const { getCourses } = require('../../moodle/crawler');

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
  const aReply = new Date(a.replyNo);
  const bReply = new Date(b.replyNo);

  return bReply - aReply;
}

const resolveCoursePathFromCode = async (code, cookieString) => {
  const courses = await getCourses({ cookieString });
  if (courses) {
    for (let i = 0; i < courses.length; i += 1) {
      if (courses[i].id === code.toUpperCase()) {
        return courses[i].path;
      }
    }
  }
  throw new Error('moodle-not-enrolled');
};

module.exports = {
  responseError,
  responseSuccess,
  handleError,
  sortBy: {
    timestamp: sortByTimestamp,
    replies: sortByReplies,
  },
  filter: {
    generic: genericFilter,
    title: titleFilter,
  },
  resolveCoursePathFromCode,
};
