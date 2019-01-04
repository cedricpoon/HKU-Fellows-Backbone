const configure = database => ({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: 3306,
  database,
  connectionLimit: 66 / 2, // t2.micro max = 66
});

module.exports = {
  config: configure,
  database: 'hkufdb',
  cacheDatabase: 'hkufdb_cache',
};
