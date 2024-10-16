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
    client_id: "c4d42d58-d09e-4c84-8c34-325a0a1e6490",
    client_secret: "uKatOGmz1xzmYVgv1MsMz8O_H-pDMebb8EHTDFTV-x0",
    data_process_inbox: "./process_data/inbox",
    data_process_outbox: "./process_data/outbox",
    data_query_period: 5,

    //Dev
    //filter_by_queues: ['4cba674e-5dff-417f-9cf4-7e5081537acf','3e80127f-20d4-47a3-a903-01dd2400f7a3'],

    //Pro
    filter_by_queues: [
      "fcd711db-2c7e-4419-a6bd-ad2cfaa96000",
      "ef03d32a-bd60-46dd-adad-6489cd7189f0",
    ],

    //Dev
    //filter_by_flow_ids: [ "d6e7a69a-1e1a-43a8-bb21-c0590e1e64e7" ],

    //Pro
    filter_by_flow_ids: [ "b15615e1-41f1-4e08-98ac-6283aff41ac5" ],
    
    filter_by_dnis: [     
      "tel:+6622014324",       
    ],

    filter_by_ani: [
      "tel:+6622014301",
      "tel:+66987481611",             
    ],

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
