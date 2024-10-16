module.exports = {
  
  GENESES: {
    org_region: "https://mypurecloud.jp",
    client_id: "c4d42d58-d09e-4c84-8c34-325a0a1e6490",
    client_secret: "uKatOGmz1xzmYVgv1MsMz8O_H-pDMebb8EHTDFTV-x0",
    // client_id: "a5f6ed41-017f-49cb-8243-29d4a820402d",
    // client_secret: "nFULyut3H65SPolQ9t5HFMfBK0MYA5KqCVettkGGupA",
    data_process_inbox: "./process_data/inbox",
    data_process_outbox: "./process_data/outbox",
    data_query_period: 5,

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
