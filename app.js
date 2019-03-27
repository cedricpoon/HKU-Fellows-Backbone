const createError = require('http-errors');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const yaml = require('js-yaml');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (app.get('env') !== 'production') {
  // swagger-ui on development only
  const swaggerDocument = yaml.safeLoad(fs.readFileSync('./docs/openapi.yml', 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // read from .env
  require('dotenv').config() //eslint-disable-line
}

fs.readdirSync('./routes', { withFileTypes: true })
  .forEach((file) => {
    if (!file.isDirectory()) {
      const name = file.name.replace(/\..+/, ''); // remove extensions
      // constraint dev only paths
      if (!file.name.includes('.dev.') || app.get('env') !== 'production') {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        app.use(`/${name === 'index' ? '' : name}`, require(`./routes/${file.name}`));
      }
    }
  });

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
