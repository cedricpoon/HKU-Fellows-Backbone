const createError = require('http-errors');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql');

const indexRouter = require('./routes/index');
const dbConfig = require('./database/config');

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error(`Database connection failed: ${err.stack}`);
    return;
  }
  console.log('Connected to database.');
});

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// pass db connection to request
app.use((req, res, next) => { req.db = db; next(); });

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res) => {
  // render the error page
  res.status(err.status || 500);
  res.json({
    status: err.status,
    error: err.message,
  });
});

module.exports = app;
