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
  SFTP: {
    host: "192.168.56.101", //10.102.46.72
    port: 22,
    username: "locus", //sftp_user
    password: "Locus123", //sftp_pass
    remote_path: "/home/locus",
    local_inbox_path: "./process_data/inbox",
    local_outbox_path: "./process_data/outbox",
  },

  GENESES: {

    data_query_callback_period : 60,
    data_query_voicemail_period : 60,
    data_query_ivrlog_period : 60,

    data_query_ABANDON_period : 1380,

    GEN_ABANDON_DATA_TABLE:{
      NAME : "CC_VDN"
    },
    DATA_TABLE_NAME:{
      NAME_CC : "CC_VDN",
    },

    DATA_TABLE_CC_IVR_MENU_LOG:{
      NAME : "CC_IVR_MENU_LOG",
    },
  },


};
