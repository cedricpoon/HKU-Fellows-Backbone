const mysql = require('mysql');
const util = require('util');

const { config, database } = require('./config');

const createPool = (_database) => {
  const pool = mysql.createPool(config(_database));

  pool.getConnection((err, connection) => {
    if (err) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error(`Database "${_database}" connection was closed.`);
      }
      if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error(`Database "${_database}" has too many connections.`);
      }
      if (err.code === 'ECONNREFUSED') {
        console.error(`Database "${_database}" connection was refused.`);
      }
    }
    if (connection) {
      connection.release();
    }
  });
  pool.query = util.promisify(pool.query);

  return pool;
};

module.exports = {
  db: createPool(database),
};
