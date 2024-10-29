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
    org_region: "https://mypurecloud.jp",
    // client_id: "a5f6ed41-017f-49cb-8243-29d4a820402d", 
    // client_secret: "nFULyut3H65SPolQ9t5HFMfBK0MYA5KqCVettkGGupA",
    client_id: "c4d42d58-d09e-4c84-8c34-325a0a1e6490",
    client_secret: "uKatOGmz1xzmYVgv1MsMz8O_H-pDMebb8EHTDFTV-x0",
    data_process_inbox: "./process_data/inbox",
    data_process_outbox: "./process_data/outbox",
    data_query_period: 20,


    SURVEY_DIVISION_DATA_TABLE:{
      NAME : "SURVEY_DIVISION"
    },

    SURVEY_EXCEPT_QUEUE_DATA_TABLE:{
      NAME : "SURVEY_EXCEPT_QUEUE"
    },
    
    SURVEY_QUEUE_DATA_TABLE:{
      SURVEY_QUEUE_NAME : "SURVEY_QUEUE_NAME"
    },

    log: {
      logging: {
        log_level: "trace",
        log_format: "text",
        log_to_console: false,
        log_file_path: "./logs/javascriptsdk.log",
        log_response_body: false,
        log_request_body: false,
      },
      reauthentication: {
        refresh_access_token: true,
        refresh_token_wait_max: 10,
      },
      general: {
        live_reload_config: true,
        host: "https://api.mypurecloud.jp",
      },
    },
  },
};
