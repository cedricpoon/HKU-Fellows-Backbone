const createError = require('http-errors');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql');
const yaml = require('js-yaml');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
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

// swagger-ui on development only
if (app.get('env') !== 'production') {
  const swaggerDocument = yaml.safeLoad(fs.readFileSync('./docs/openapi.yml', 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// pass db connection to request
app.use((req, res, next) => { req.db = db; next(); });

app.use('/', indexRouter);
app.use('/login', loginRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // render the error page
  res.status(err.status || 500);
  res.json({
    status: err.status,
    error: err.message,
  });
});

module.exports = app;
