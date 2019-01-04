const mysql = require('mysql');
const util = require('util');

const config = require('./config');

const normalPool = mysql.createPool(config.para('hkufdb'));
const cachePool = mysql.createPool(config.para('hkufdb_cache'));

normalPool.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  }
  if (connection) {
    connection.release();
  }
});

cachePool.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  }
  if (connection) {
    connection.release();
  }
});

normalPool.query = util.promisify(normalPool.query);
cachePool.query = util.promisify(cachePool.query);

module.exports = { db: normalPool, cachedb: cachePool };
