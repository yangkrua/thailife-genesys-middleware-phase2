const Client = require("ssh2-sftp-client");
const sftp = new Client();
const log = require("../functions/logger.js").LOG;
const fs = require("node:fs");

const path = require("path");
const moment = require("moment");

const config = require("../config/server.js");
const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();
const usersApi = new platformClient.UsersApi();
//const routingApi            = new platformClient.RoutingApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = config.GENESES.client_id;
const CLIENT_SECRET = config.GENESES.client_secret;
client.setEnvironment(config.GENESES.org_region);

/*
 * getUserLists
 */
let getUserLists = async () => {
  let usersObj;

  await usersApi
    .getUsers({
      pageSize: 100,
      pageNumber: 1,
      sortOrder: "asc",
      state: "active",
    })
    .then(async (data) => {
      log.info(`usersApi.getUsers(), Page=1, Result= ${JSON.stringify(data)}`);

      usersObj = await data;
      for (let j = 2; j <= data.pageCount; j++) {
        let dataResult = await usersApi.getUsers({
          pageSize: 100,
          pageNumber: j,
          sortOrder: "asc",
          state: "active",
        });

        log.info(
          `usersApi.getUsers(), Page=${j}, Result= ${JSON.stringify(data)}`
        );
        Array.prototype.push.apply(usersObj.entities, dataResult.entities);
      }
    });

  return usersObj;
};



/*
 * AnalyticsConversationsDetailsQuery
 */
let AnalyticsConversationsDetailsQuery_ANumberReport = async  () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      //let body = {"interval": "2024-02-01T00:00:00.000Z/2024-02-07T00:00:00.000Z"}; // Object | query

      const pDate = moment().add(-1, "days");
      const timePeriod = pDate.format("YYYY-MM-DDT00:00:00.000Z") + "/" + pDate.format("YYYY-MM-DDT23:59:59.000Z");

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: timePeriod,
        segmentFilters: [
          {
            predicates: [
              {
                dimension: "purpose",
                value: "Customer",
              },
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body)}`);
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery( body );
          log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber }, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        let lineCDR = await parserCDR_A_Number(conversationObj);
        if ((await lineCDR.length) > 98) {
          const localPath = `${config.GENESES.data_process_inbox}/A_NUMBER_REPORT_${moment().format("YYYYMMDD_HHmmss")}.txt`;
          await writeFile(localPath, lineCDR);
          ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

/*
 * GetCDRtFlowAbandonCall By Day -1
 */
let GetCDRtFlowAbandonCall = async () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("GetCDRtFlowAbandonCall->login(), success fully!");
      
      const pDateStart = moment().add(-config.GENESES.data_query_period, "minute");
      const pDateStop = moment();

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        segmentFilters: [
          {
            predicates: [
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->GetCDRtFlowAbandonCall(), Body= ${JSON.stringify(body )}` );
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info( `API->GetCDRtFlowAbandonCall(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
          log.info( `API->GetCDRtFlowAbandonCall(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        let lineCDR = await parserCDR_ABAN_BY_tFlow(conversationObj);
        if (lineCDR.length > 98) {
          const localPath = `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${moment().format("YYYYMMDD_HHmmss")}.txt`;
          await writeFile(localPath, lineCDR);
          ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->GetCDRtFlowAbandonCall(), error: ${error.message}`);
    });
};

/*
 * Generate AbandonCall By Day -1
 */
let AnalyticsConversationsDetailsQuery = async () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      //let body = {"interval": "2024-02-01T00:00:00.000Z/2024-02-07T00:00:00.000Z"}; // Object | query
      //dev
      //const pDateStart =  moment('2024-04-04T00:00:00.000');
      //const pDateStop  =  moment('2024-04-04T23:59:59.000');

      //pro
      const pDateStart = moment().add(-config.GENESES.data_query_period, "minute");
      const pDateStop = moment();

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        segmentFilters: [
          {
            predicates: [
              {
                dimension: "purpose",
                value: "Customer",
              },
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body )}` );
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
          log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        let lineCDR = await parserCDR(conversationObj);
        if (await lineCDR.length > 98) {
          const localPath = await `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${moment().format("YYYYMMDD_HHmmss")}.txt`;
          await writeFile(localPath, lineCDR);
          ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

/*
 * GetLoginLogoutDailyReport
 */
let GetLoginLogoutDailyReport = async() => {
  await  client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("GetUsers->login(), success fully!");
      let users = await getUserLists();

      log.info(`API->GetUsers, Result: ${JSON.stringify(users)}`);
      const pDate = moment().add(-1, "days");
      const timePeriod = pDate.format("YYYY-MM-DDT00:00:00.000Z") + "/" + pDate.format("YYYY-MM-DDT23:59:59.000Z");

      let body = {
        interval: timePeriod,
        presenceFilters: [
          {
            type: "or",
            predicates: [
              {
                dimension: "systemPresence",
                value: "AVAILABLE",
              },
              {
                dimension: "systemPresence",
                value: "OFFLINE",
              },
            ],
          },
        ],
        presenceAggregations: [
          {
            type: "termFrequency",
            dimension: "organizationPresenceId",
            size: 50,
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info(`usersApi.postAnalyticsUsersDetailsQuery->Body= ${JSON.stringify(body)}` );
      let textDataHeader = "ID|USERNAME|EMAIL|START_TIME|STOP_TIME|DURATION";
      let textDataBody = "";
      let pageTotal = 2;
      let dataResult;

      dataResult = await usersApi.postAnalyticsUsersDetailsQuery(body);
      log.info( `API->postAnalyticsUsersDetailsQuery, PageNo=1, Result: ${JSON.stringify(dataResult)}`);

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        //first Page
        textDataBody = await parserUsersLoginAvailable(dataResult, users);

        //seconds Page
        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await usersApi.postAnalyticsUsersDetailsQuery(body);
          log.info( `API->postAnalyticsUsersDetailsQuery, PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}`);

          textDataBody += await "\n";
          textDataBody += await parserUsersLoginAvailable(dataResult, users);
        } //end for
      }

      //ftp file
      if (textDataBody !== "") {
        const localPath = `${config.GENESES.data_process_inbox}/LOGIN_LOGOUT_DAILY_${moment().format("YYYYMMDD_HHmmss")}.txt`;
        await writeFile(localPath, `${textDataHeader}\n${textDataBody}\n`);
        await ftpFileCDR(localPath);
      }
    })
    .catch((error) => {
      log.error(`API->GetUsers(), error: ${error.message}`);
    });
};



/*
 * ManualGenA_Number_Report_ByDate
 */
let ManualGenA_Number_Report_ByDate = async (pDate) => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      const pDateStart = moment(pDate + "T00:00:00.000");
      const pDateStop = moment(pDate + "T23:59:59.000");

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        segmentFilters: [
          {
            predicates: [
               {
                 "dimension": "purpose",
                 "value": "Customer"
               },
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body)}` );
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}`);

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery( body );
          log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}`);
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        let lineCDR = await parserCDR_A_NumberReportByDate(conversationObj);
        if ((await lineCDR.length) > 98) {          
          const localPath = `${config.GENESES.data_process_inbox}/A_NUMBER_REPORT_${pDate}_000000.txt`;
          await writeFile(localPath, lineCDR);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

/*
 * ManualGenAbandonCallByDate
 */
let ManualGenAbandonPhoneListByDate = async (pDate) => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      //let body = {"interval": "2024-02-01T00:00:00.000Z/2024-02-07T00:00:00.000Z"}; // Object | query

      const pDateStart = moment(pDate + "T00:00:00.000");
      const pDateStop = moment(pDate + "T23:59:59.000");

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),    
        segmentFilters: [
          {
            predicates: [
              {
                dimension: "purpose",
                value: "Customer",
              },
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info(`API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body)}`);
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}`);

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(
            body
          );
          log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        log.info(`API->PHONE_LIST, Date=${pDate}, Results= ${JSON.stringify(conversationObj)}`);

        let lineCDR = await parserCDR_BY_PHONE_LIST(conversationObj);
        if ((await lineCDR.length) > 98) {
          //const localPath = `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${moment().format('YYYYMMDD_HHmmss')}.txt`;
          const localPath = `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${pDate}_000000.txt`;
          await writeFile(localPath, lineCDR);
          //ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

/*
 * ManualGenAbandonCallByDate
 */
let ManualGenAbandonQueueByDate = async (pDate) => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      //let body = {"interval": "2024-02-01T00:00:00.000Z/2024-02-07T00:00:00.000Z"}; // Object | query

      const pDateStart = moment(pDate + "T00:00:00.000");
      const pDateStop = moment(pDate + "T23:59:59.000");

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"), 
        segmentFilters: [
          {
            predicates: [
              {
                dimension: "purpose",
                value: "Customer",
              },
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body)}`);
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult )}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(
            body
          );

          log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber }, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        log.info( `API->QueueByDate, Date=${pDate}, Results= ${JSON.stringify( conversationObj )}` );

        let lineCDR = await parserCDR_BY_Queue_LIST(conversationObj);
        if ((await lineCDR.length) > 98) {
          const localPath = `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${pDate}_000000.txt`;
          await writeFile(localPath, lineCDR);
          //ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

/*
 * ManualGenLoginLogoutByDateReport
 */
let ManualGenLoginLogoutByDateReport = async(pDate) => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("GetUsers->login(), success fully!");
      let users = await getUserLists();
      log.info(`API->GetUsers, Result: ${JSON.stringify(users)}`);

      const pDateStart = moment(pDate + "T00:00:00.000");
      const pDateStop = moment(pDate + "T23:59:59.000");

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        presenceFilters: [
          {
            type: "or",
            predicates: [
              {
                dimension: "systemPresence",
                value: "AVAILABLE",
              },
              {
                dimension: "systemPresence",
                value: "OFFLINE",
              },
            ],
          },
        ],
        presenceAggregations: [
          {
            type: "termFrequency",
            dimension: "organizationPresenceId",
            size: 50,
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `usersApi.postAnalyticsUsersDetailsQuery->Body= ${JSON.stringify(body)}` );
      let pageTotal = 2;
      let dataResult;

      dataResult = await usersApi.postAnalyticsUsersDetailsQuery(body);
      log.info( `API->postAnalyticsUsersDetailsQuery, PageNo=1, Result: ${JSON.stringify( dataResult )}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        //first Page
        textDataBody = await parserUsersLoginAvailable(dataResult, users);

        //seconds Page
        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await usersApi.postAnalyticsUsersDetailsQuery(body);
          log.info( `API->postAnalyticsUsersDetailsQuery, PageNo=${ body.paging.pageNumber }, Result: ${JSON.stringify(dataResult)}` );

          //textDataBody += await "\n";
          //textDataBody += await parserUsersLoginAvailable(dataResult, users);
        } //end for
      }

      //ftp file
      //if ((await lineCDR.length) > 98) { 
      if ((await textDataBody) !== "") {
        const localPath = `${config.GENESES.data_process_inbox}/LOGIN_LOGOUT_DAILY_${pDate}_000000.txt`;
        await writeFile(localPath, `${textDataHeader}\n${textDataBody}`);
        //await ftpFileCDR(localPath);
      }
    })
    .catch((error) => {
      log.error(`API->GetUsers(), error: ${error.message}`);
    });
};

/*
 * ManualGenAbandonWith_n_Flow_ByDate
 */
let ManualGenAbandonWith_tFlow_ByDate = async(pDate) => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
      
      const pDateStart = moment(pDate + "T00:00:00.000");
      const pDateStop = moment(pDate + "T23:59:59.000");

      let pageTotal = 2;
      let dataResult;
      let conversationObj;

      let body = {
        interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        segmentFilters: [
          {
            predicates: [              
              {
                dimension: "direction",
                value: "inbound",
              },
            ],
            type: "and",
          },
        ],
        paging: {
          pageSize: 100,
          pageNumber: 1,
        },
        order: "asc",
      };

      log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body)}` );
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery( body );
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(
            body
          );

          log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${ body.paging.pageNumber }, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        log.info( `API->QueueByDate, Date=${pDate}, Results= ${JSON.stringify( conversationObj )}` );

        let lineCDR = await parserCDR_ABAN_BY_tFlow(conversationObj);
        if ((await lineCDR.length) > 98) {          
          const localPath = `${config.GENESES.data_process_inbox}/L_ABANDON_CALL_${pDate}_000000.txt`;
          await writeFile(localPath, lineCDR);
          //ftpFileCDR(localPath);
        }
      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
};

//========================Internal-Function===========================
let writeFile = async (path, content) => {
  log.info(`====== writeFile, path=${path}`);
  await fs.writeFileSync(path,content,{encoding:'utf8',flag:'w'})
};

let moveFile = async (srcFile) => {
  const destFile = await `${config.SFTP.local_outbox_path}/${moment().format(
    "YYYYMMDD"
  )}/${path.basename(srcFile)}`;

  if (await !fs.existsSync(path.dirname(destFile))) {
    fs.mkdirSync(path.dirname(destFile));
  }
  
  await fs.rename(srcFile, destFile, function (err) {
    if (err) {
      log.error(`API->moveFile(), error: ${err.message}`);
      return;
    }
    log.info(`API->moveFile(), Success Fully!`);
  });
};

let getUserName = (users, user_id) => {
  if(users === undefined){ return "|"; }

  for (const user of users.entities) {
    if (user.id === user_id) {
      return user.name + "|" + user.email;
    }
  }
  return "|";
};

let getUserLoginTime = async (primaryPresence) => {
  let st, et;

  for (const item of primaryPresence) {
    if ((await item.systemPresence) === "OFFLINE" && (await st) === undefined) {
      continue;
    }

    //--next item
    if (
      (await item.systemPresence) === "AVAILABLE" &&
      (await st) === undefined
    ) {
      st = await moment(item.startTime);
      et = await moment(item.startTime);
      continue;
    }

    if ((await item.systemPresence) === "OFFLINE") {
      et = await moment(item.startTime);
    }
  } //end for

  if ((await st) === undefined || (await et) === undefined) {
    st = await moment(primaryPresence[0].startTime);
    et = await moment(primaryPresence[0].startTime);
  }

  const duration = await moment.duration(et.diff(st));
  const ss = await duration.seconds();
  const mm = await duration.minutes();
  const hh = await duration.hours();

  return await {
    startTime: `${st.format("YYYY-MM-DD HH:mm:ss")}`,
    endTime: `${et.format("YYYY-MM-DD HH:mm:ss")}`,
    ttl: `${hh.toFixed(0).padStart(2, "0")}:${mm
      .toFixed(0)
      .padStart(2, "0")}:${ss.toFixed(0).padStart(2, "0")}`,
  };
};



let parserUsersLoginAvailable = async (data, users) => {
  log.info(`====== parserUsersLoginAvailable->Begin =======`);

  let textUsers = "";
  try {
    for (const item of data.userDetails) {
      let userInfo = await getUserLoginTime(item.primaryPresence);
      if ((await textUsers) !== "") {
        textUsers += "\n";
      }

      textUsers += await item.userId + "|"; //ID
      textUsers += await getUserName(users, item.userId) + "|"; //USERNAME|EMAIL
      textUsers += await userInfo.startTime + "|"; //START_TIME
      textUsers += await userInfo.endTime + "|"; //STOP_TIME
      textUsers += await userInfo.ttl; //DURATION_TIME
    }
  } catch (error) {
    log.error(`API->parserUsersLoginAvailable(), error: ${error.message}`);
  }

  return textUsers;
};


let parserPhoneNumber = (mobile) => {
  return mobile.replace("+66", "0");
};
let parserTelPhoneNumber = async (mobile) => {
  if (mobile.startsWith("tel:")) {
    return mobile.replace("tel:", "");
  } else if (mobile.startsWith("sip:")) {
    return mobile.replace("sip:", "");
  }
  return mobile; // ถ้าไม่มีเงื่อนไขใดตรง จะคืนค่าตัวแปร a กลับไป
};
let isValidPhoneNumber = async (mobile) => {
  //"ani": "tel:+66955093246",
  //"dnis": "tel:+6622014355"
  if (await mobile !== undefined && await mobile.length >= 14) return true;
  return false;
};

let parserCDR_A_NumberReportByDate = async (data) => {
  log.info(`API->CDR_A_NumberReportByDate, Raw-Data= ${JSON.stringify(data)}`);
  
  let cdrHeader = await "SEGSTART_DT|SEGSTART_TIME|CALL_DISP|DIALED_NUM|CALLING_PTY|TELEPHONE|CALL_ID";
  let  textCRD = await '';

  for (const item of data.conversations) {
    
    if (
      (await isValidPhoneNumber(item.participants[0].sessions[0].ani)) &&
      (await isValidPhoneNumber(item.participants[0].sessions[0].dnis)) &&
      (await istAbandon(item.participants))
    ) {
      textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD") + "|"); //SEGSTART_DT
      textCRD += await  (moment(item.conversationEnd).format("HH:mm:ss") + "|"); //SEGSTART_TIME
      textCRD += await  ("abandoned" + "|"); //CALL_DISP
      textCRD += await  ("" + "|"); // DIALED_NUM
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1]) +  "|"); // CALLING_PTY
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].dnis.split(":")[1]) + "|"); // TELEPHONE
      textCRD += await  item.conversationId; // conversationId
      textCRD += await  "\n";
    } else if (
      (await isValidPhoneNumber(item.participants[0].sessions[0].ani)) &&
      (await isValidPhoneNumber(item.participants[0].sessions[0].dnis))
    ) {
      
      textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD") + "|"); //SEGSTART_DT
      textCRD += await  (moment(item.conversationEnd).format("HH:mm:ss") + "|"); //SEGSTART_TIME
      textCRD += await  ("answered" + "|"); //CALL_DISP
      textCRD += await  ("" + "|"); // DIALED_NUM
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1])  + "|"); // CALLING_PTY
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].dnis.split(":")[1]) + "|"); // TELEPHONE
      textCRD += await  item.conversationId; // conversationId
      textCRD += await  "\n";
    }
  }

  await log.info(`====== parserCDR-A-Number->Done! =======`);
  return await (headerCRD + "\n" + textCRD);
};

let isTransactionInboundCaptureByPhoneLists = async (data_participants) => {
  for (const item of data_participants) {
    for (const session of item.sessions) {
      if ((await session.dnis) !== undefined) {
        for (const phone of config.GENESES.filter_by_dnis) {
          if ((await session.dnis) === phone) {
            return true;
          }
        }
      }
    }
  }

  return false;
};


let isTransactionInboundCaptureByQueue = async (data_participants) => {
  for (const item of data_participants) {
    for (const obj of item.sessions[0].segments) {
      if (obj.queueId !== undefined) {
        for (const queue_id of config.GENESES.filter_by_queues) {
          if ((await obj.queueId) === queue_id) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

let isTransactionInboundCaptureFlowID = async (data_participants) => {
  for (const item of data_participants) {
    for (const pID of config.GENESES.filter_by_flow_ids) {
      if (await item.sessions[0].flow !== undefined 
       && await item.sessions[0].flow.flowId === pID) {
        return true;
      }
    }
  }

  return false;
};

let istAbandon = async (data_participants) => {
  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tAbandon") {
          return true;
        }
      }
    }
  }

  return false;
};

let istFlow = async (data_participants) => {
  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tFlowDisconnect") {
          return true;
        }
      }
    }
  }

  return false;
};

let parserCDR_A_Number = async (data) => {
  await log.info( `======***parserCDR_A_Number***, Raw-Data= ${JSON.stringify(data)}` );
  await log.info(`====== parserCDR-A-Number->Begin =======`);

  let headerCRD = await "SEGSTART_DT|SEGSTART_TIME|CALL_DISP|DIALED_NUM|CALLING_PTY|TELEPHONE";
  let textCRD   = await '';

  for (const item of data.conversations) {
 
    if (
      (await isValidPhoneNumber(item.participants[0].sessions[0].ani)) &&
      (await isValidPhoneNumber(item.participants[0].sessions[0].dnis)) &&
      (await istAbandon(item.participants))
    ) {
      textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD") + "|"); //SEGSTART_DT
      textCRD += await  (moment(item.conversationEnd).format("HH:mm:ss") + "|"); //SEGSTART_TIME
      textCRD += await  "abandoned" + "|"; //CALL_DISP
      textCRD += await  ("" + "|"); // DIALED_NUM
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1]) +  "|"); // CALLING_PTY
      textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] )); // TELEPHONE
      textCRD += await  "\n";
    } else if (
      (await isValidPhoneNumber(item.participants[0].sessions[0].ani)) &&
      (await isValidPhoneNumber(item.participants[0].sessions[0].dnis))
    ) {
      textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD") + "|"); //SEGSTART_DT
      textCRD += await  (moment(item.conversationEnd).format("HH:mm:ss") + "|"); //SEGSTART_TIME
      textCRD += await  ("answered" + "|"); //CALL_DISP
      textCRD += await  ("" + "|"); // DIALED_NUM
      textCRD += await  (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1]) + "|"); // CALLING_PTY
      textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] )); // TELEPHONE
      textCRD += await  "\n";
    }
  }

  await log.info(`====== parserCDR-A-Number->Done! =======`);
  return await (headerCRD + "\n" + textCRD);
};

let parserCDR = async (data) => {
  await log.info( `======***parserCDR***, Raw-Data= ${JSON.stringify(data)}` );
  await log.info(`====== parserCDR->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO"; 
  let textCRD   = await '';

  for (const item of data.conversations) {
    if (await isTransactionInboundCaptureByQueue(item.participants)) {
      if (await istAbandon(item.participants)) {
        textCRD += await  parserPhoneNumber( item.participants[0].sessions[0].ani.split(":")[1] ) + "|"; //CALLING_PTY
        textCRD += await  "P" + "|"; //STATUS
        textCRD += await  moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //IMPORT_DATE
        textCRD += await  moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //CHG_TIME
        textCRD += await  item.conversationId + "|"; //CALLID
        textCRD += await  moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"; //SEGSTART
        textCRD += await  moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"; //SEGSTOP
        textCRD += await  "3|"; //DISPOSITION
        textCRD += await  parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] ) + "|"; //DISPVDN
        textCRD += await  item.conversationId + "|"; //UCID
        textCRD += await  999; //ROUND_NO
        textCRD += await  '\n';
      }
    }
  }

  await log.info(`====== parserCDR->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};

let parserCDR_BY_PHONE_LIST = async (data) => {
  await log.info( `======***parserCDR_BY_PHONE_LIST***, Raw-Data= ${JSON.stringify(data)}` );
  await log.info(`====== parserCDR->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO|ANI|DNIS";
  let textCRD   = await '';

  for (const item of data.conversations) {
    
    if (await isTransactionInboundCaptureByPhoneLists(item.participants)) {
      if (await istAbandon(item.participants)) {
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].ani.split(":")[1] ) + "|"); //CALLING_PTY
        textCRD += await  ("P" + "|"); //STATUS
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //IMPORT_DATE
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //CHG_TIME
        textCRD += await  (item.conversationId + "|"); //CALLID
        textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
        textCRD += await  (moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTOP
        textCRD += await  "3|"; //DISPOSITION
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] ) + "|"); //DISPVDN
        textCRD += await  (item.conversationId + "|"); //UCID
        textCRD += await  (999 + "|"); //ROUND_NO
        textCRD += await  (item.participants[0].sessions[0].ani + "|");
        textCRD += await  (item.participants[0].sessions[0].dnis);
        textCRD += await  "\n";

      }
    }
  }

  await log.info(`====== parserCDR->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};

let parserCDR_BY_Queue_LIST = async (data) => {
  await log.info( `======***parserCDR_BY_Queue_LIST***, Raw-Data= ${JSON.stringify(data)}` );
  await log.info(`====== parserCDR->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO";
  let textCRD = await '';

  for (const item of data.conversations) {
    
    if (await isTransactionInboundCaptureByQueue(item.participants)) {
      if (await istAbandon(item.participants)) {
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].ani.split(":")[1] ) + "|"); //CALLING_PTY
        textCRD += await  ("P" + "|"); //STATUS
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //IMPORT_DATE
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //CHG_TIME
        textCRD += await  (item.conversationId + "|"); //CALLID
        textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
        textCRD += await  (moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTOP
        textCRD += await  "3|"; //DISPOSITION
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] ) + "|"); //DISPVDN
        textCRD += await  (item.conversationId + "|"); //UCID
        textCRD += await  999; //ROUND_NO
        textCRD += await  "\n";

      }
    }
  }

  await log.info(`====== parserCDR->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};

let parserCDR_ABAN_BY_tFlow = async (data) => {
  await log.info( `======***parserCDR_ABAN_BY_tFlow***, Raw-Data= ${JSON.stringify(data)}` );
  await log.info(`====== parserCDR_ABAN_BY_tFlow ->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO"; 
  let textCRD   = await '';

  for (const item of data.conversations) {
    
    if (await isTransactionInboundCaptureFlowID(item.participants)) {
      if (await istFlow(item.participants)) {
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].ani.split(":")[1] ) + "|"); //CALLING_PTY
        textCRD += await  ("P" + "|"); //STATUS
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //IMPORT_DATE
        textCRD += await  (moment().format("YYYY-MM-DD HH:mm:ss") + "|"); //CHG_TIME
        textCRD += await  (item.conversationId + "|"); //CALLID
        textCRD += await  (moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
        textCRD += await  (moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTOP
        textCRD += await  "3|"; //DISPOSITION
        textCRD += await  (parserPhoneNumber( item.participants[0].sessions[0].dnis.split(":")[1] ) + "|"); //DISPVDN
        textCRD += await  (item.conversationId + "|"); //UCID
        textCRD += await  999; //ROUND_NO
        textCRD += await  "\n";


      }
    }
  }

  await log.info(`====== parserCDR_ABAN_BY_tFlow->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};

let ftpFileCDR = (localPath) => {
  log.info("ftpFileCDR(), Begin... Uploading...");
  sftp
    .connect({
      host: config.SFTP.host,
      port: config.SFTP.port,
      username: config.SFTP.username,
      password: config.SFTP.password,
    })
    .then(() => {
      return sftp.put(
        localPath,
        `${config.SFTP.remote_path}/${path.basename(localPath)}`
      );
    })
    .then((data) => {
      log.info(`API->ftpFileCDR(), success fully: ${data}`);
      sftp.end();
      moveFile(localPath);
    })
    .catch((err) => {
      log.error(`API->ftpFileCDR(), error: ${err.message}`);
    });
};

module.exports = {
  
  GetLoginLogoutDailyReport,
  GetCDRtFlowAbandonCall,
  AnalyticsConversationsDetailsQuery,
  AnalyticsConversationsDetailsQuery_ANumberReport,
  ManualGenAbandonPhoneListByDate,
  ManualGenAbandonQueueByDate,
  ManualGenA_Number_Report_ByDate,
  ManualGenLoginLogoutByDateReport,
  ManualGenAbandonWith_tFlow_ByDate,  
};
