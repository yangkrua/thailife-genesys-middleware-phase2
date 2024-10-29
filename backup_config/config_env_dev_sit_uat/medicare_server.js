module.exports = {
  Host: "localhost",
  Port: 8080,
  UserAdmin: "admin",
  Password: "1234567890",
  Authorize: {
    Api_Key: "fd7d3f7e",
    Api_Secret: "8hsBZAtFrdxuF2lQ",
    Api_TokenExpiresIn: "1d", // 15m, 1h, 1d
    Application_Id: "f4607a2f-61b3-4074-921c-360f90b672d8",
  },
  MorganLogger: {
    Filename: "server.log",
    DatePattern: "YYYY-MM-DD",
    MaxFile: "30",
    Interval: "1d", // '5s','5m', '2h', '1d', '1M'
    LogLevel: "DEBUG",
  },
  WinstonLogger: {
    filename: "./logs/server.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "200m",
    maxFiles: "1d", // '5s','5m', '2h', '1d', '1M'
  },

  GENESES: {
    GEN_ABANDON_DATA_TABLE:{
      NAME : "MEDICARE_VDN"
    },
  },
};
