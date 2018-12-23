module.exports = {
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: 3306,
  database: 'hkufdb',
  connectionLimit: 60, // t2.micro max = 66
};
