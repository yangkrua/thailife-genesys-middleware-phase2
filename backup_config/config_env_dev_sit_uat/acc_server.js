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


    SFTP_ACC_OUT_CALLBACK: {
      host: "192.168.100.71", //10.102.46.72
      port: 22,
      username: "middleware", //sftp_user
      password: "P@ssw0rd", //sftp_pass
      remote_path: "/UAT",
      local_inbox_path: "./process_data/inbox",
      local_outbox_path: "./process_data/outbox",
    },
    
    GENESES: {
      org_region: "https://mypurecloud.jp",
      client_id: "d14944af-c2b2-44c2-a6b4-b3925e959557",
      client_secret: "4MatjV5bAvy4IIhoV1NzM75olmyg30ocDp6xeME0oTk",
      data_process_inbox: "./process_data/inbox",
      data_process_outbox: "./process_data/outbox",
      data_query_period: 5,
      DATA_QUERY_SURVEY_PERIOD: 5,
      DATA_QUERY_ABANDON_ACC_INB_PERIOD: 5,
      DATA_QUERY_ABANDON_ACC_OUTB_PERIOD: 5,
      DATA_QUERY_START_WORKING_HOUR: "08:30",
      DATA_QUERY_END_WORKING_HOUR: "17:30",

      data_query_ABANDON_period : 1380,

      data_query_callback_period : 60,
      data_query_voicemail_period : 60,
      data_query_ABANDON_OUTB_period : 11,
      data_query_CALLBACK_OUTBOUND_period : 11,
      
      //Pro
      filter_by_flow_ids: [ "b15615e1-41f1-4e08-98ac-6283aff41ac5" ],
      
      filter_by_dnis: [     
        "tel:+6622014324",       
      ],
  
      filter_by_ani: [
        "tel:+6622014301",
        "tel:+66987481611",             
      ],

      ACC_INB_GEN_ABANDON_DATA_TABLE:{
        NAME : "ACC_INB_VDN"
      },

      ACC_OUTB_VDN_GEN_ABANDON_DATA_TABLE:{
        NAME : "ACC_OUTB_VDN"
      },

      DATA_TABLE_NAME:{
        ACC_INB_VDN : "ACC_INB_VDN",
        ACC_OUTB_VDN : "ACC_OUTB_VDN",
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
    GENESES_UAT: {
      org_region: "https://mypurecloud.jp",
      client_id: "d14944af-c2b2-44c2-a6b4-b3925e959557", //
      client_secret: "4MatjV5bAvy4IIhoV1NzM75olmyg30ocDp6xeME0oTk", //
      data_process_inbox: "./process_data/inbox",
      data_process_outbox: "./process_data/outbox",
      data_query_period: 5,
      DATA_QUERY_SURVEY_PERIOD: 5,
      DATA_QUERY_ABANDON_ACC_INB_PERIOD: 5,
      DATA_QUERY_ABANDON_ACC_OUTB_PERIOD: 5,

    },
  };
