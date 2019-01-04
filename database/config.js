const para = (db => ({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: 3306,
  database: db,
  connectionLimit: 30, // t2.micro max = 66
}));

module.exports = { para };
