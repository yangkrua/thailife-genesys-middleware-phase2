
const Client = require("ssh2-sftp-client");
const sftp = new Client();
const log = require("./logger.js").LOG;
const fs = require("node:fs");

const path = require("path");
const moment = require("moment");
const dbservice = require('./acc_dbservice');
const config = require("../config/acc_server.js");
const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();
const voiceApi = new platformClient.VoicemailApi();
//const routingApi            = new platformClient.RoutingApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = config.GENESES.client_id;
const CLIENT_SECRET = config.GENESES.client_secret;
client.setEnvironment(config.GENESES.org_region);

let pDate = null;


let Gen_ACC_VOICEMAIL = async () => {

  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

      let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.ACC_INB_VDN);
      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let dataQueueIdObj = await VoicemailGetQueueIdInDataTableByID(dataTableId);
        log.info("dataTableId : " + dataTableId);
        log.info(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await ACC_VOICEMAIL(dataQueueIdObj);

      }
    })
    .catch((error) => {
      log.error(`API->Gen_ACC_VOICEMAIL(), error: ${error.message}`);
    });

  log.info("End Process Gen_ACC_VOICEMAIL :" + await new Date());

};

let ACC_VOICEMAIL = async (dataQueueIdObj) => {

  let pDateStart = moment().subtract(config.GENESES.data_query_voicemail_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  if (pDate != null) {
    pDateStart = moment(pDate + "T00:00:00.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    pDateStop = moment(pDate + "T23:59:59.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  }

  let pageTotal = 2;
  let dataResult;
  let conversationObj;

  let body = {
    interval: pDateStart + "/" + pDateStop,
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
      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}`);
      Array.prototype.push.apply(
        conversationObj.conversations,
        dataResult.conversations
      );
    } //end for

    let lineCDR = await parserCDR_ACC_VOICEMAIL(conversationObj, dataQueueIdObj);
    if (await lineCDR.length > 0) {
      await dbservice.insertIvrAccVoicemail(lineCDR.split("\n"));
    }
  }

};

let parserCDR_ACC_VOICEMAIL = async (data, dataQueueIdObj) => {
  log.info(`====== parserCDR_ACC_VOICEMAIL->Begin =======`);

  let textCRD = '';

  for (const item of data.conversations) {

    const voicemailValue = isTransactionCaptureVoicemailByQueue(item.participants, dataQueueIdObj);
    const VoiceValueFirst = voicemailValue[0];
    const VoiceValueSecond = voicemailValue[1];

    if (VoiceValueFirst) {
      //getVoicemail
      let MessageResult = await voiceApi.getVoicemailQueueMessages(VoiceValueSecond);
      let message_id = FilterMessageId(item.conversationId, MessageResult.entities);
      // Get call conversation
      await apiInstance.getConversationsCall(item.conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
        .then(async (data) => {
          if (
            (await data) !== undefined &&
            (await data.participants) !== undefined &&
            (await data.participants.length) > 0
          ) {
            for (let index_p = 0; index_p < data.participants.length; index_p++) {
              let participant = await data.participants[index_p];
              log.info(`API->postAnalyticsConversationsDetailsQuery(), Result: ${JSON.stringify(data)}`);
              if (
                (await participant) !== undefined &&
                (await participant.attributes) !== undefined &&
                (await participant.attributes.VM_INFO) !== undefined
              ) {
                let ucid = item.conversationId;
                let customerphoneNumber = parserPhoneNumber(participant.attributes.ANI_NUMBER);
                let conversationstartTime = await convertData(participant.startTime);
                let agentcode = await convertData(participant.attributes.AGENT_CODE);

                await apiInstance.postConversationDisconnect(ucid)
                  .then(async (data) => {
                    log.info(`ACC_VOICEMAIL postConversationDisconnect success! data: ${ucid} ,  ${JSON.stringify(data, null, 2)}`);
                  })
                  .catch(async (err) => {
                    log.error(`ACC_VOICEMAIL There was a failure calling postConversationDisconnect : ${ucid}, ${err}`);

                  });


                textCRD += await (ucid + "|"); //UCID
                textCRD += await (customerphoneNumber + "|"); //Customer
                textCRD += await (moment(conversationstartTime).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                textCRD += await (agentcode + "|"); //Agent Code
                textCRD += await (message_id + "|");
                textCRD += await "ACC"
                textCRD += await "\n";
                break;
              }
            }
          }
        })
        .catch(async (err) => {
          log.error(`There was a failure calling getConversationsCall, ${err}`);
        });
    }
  }
  log.info(`====== parserCDR_ACC_VOICEMAIL->Done! =======`);
  return textCRD;
};


let Gen_ACC_CALLBACK = async () => {
  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

      let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.ACC_INB_VDN);
      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let dataQueueIdObj = await CallbackGetQueueIdInDataTableByID(dataTableId);
        console.log("dataTableId : " + dataTableId);
        console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await ACC_CALLBACK(dataQueueIdObj);

      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });

  log.info("End Process Gen_ACC_CALLBACK :" + await new Date());
};

let ACC_CALLBACK = async (dataQueueIdObj) => {

  let pDateStart = moment().subtract(config.GENESES.data_query_callback_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

  if (pDate != null) {
    pDateStart = moment(pDate + "T00:00:00.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    pDateStop = moment(pDate + "T23:59:59.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  }

  log.info('Start ' + pDateStart + '/' + 'End ' + pDateStop);

  let pageTotal = 2;
  let dataResult;
  let conversationObj;

  let body = {
    interval: pDateStart + "/" + pDateStop,
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
      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      log.info(`API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}`);
      Array.prototype.push.apply(
        conversationObj.conversations,
        dataResult.conversations
      );
    } //end for

    let lineCDR = await parserCDR_ACC_CALLBACK(conversationObj, dataQueueIdObj);
    if (await lineCDR.length > 0) {
      await dbservice.insertIvrAccCallback(lineCDR.split("\n"));
    }
  }

};

let parserCDR_ACC_CALLBACK = async (data, dataQueueIdObj) => {
  log.info(`====== parserCDR_ACC_CALLBACK->Begin =======`);
  let textCRD = '';
  for (const item of data.conversations) {
    if (isTransactionCaptureByQueue(item.participants, dataQueueIdObj)) {
      // Get call conversation
      await apiInstance.getConversationsCall(item.conversationId)
        .then(async (data) => {
          if (
            (await data) !== undefined &&
            (await data.participants) !== undefined &&
            (await data.participants.length) > 0
          ) {
            for (let index_p = 0; index_p < data.participants.length; index_p++) {
              let participant = await data.participants[index_p];
              //log.info( `API->postAnalyticsConversationsDetailsQuery(), Result: ${JSON.stringify(data)}` );
              if (
                (await participant) !== undefined &&
                (await participant.attributes) !== undefined &&
                (await participant.attributes.CB_INFO) !== undefined
              ) {
                let ucid = item.conversationId;
                let customerphoneNumber = parserPhoneNumber(participant.attributes.ANI_NUMBER);
                let conversationstartTime = participant.startTime;
                let agentcode = await convertData(participant.attributes.AGENT_CODE);


                await apiInstance.postConversationDisconnect(ucid)
                  .then(async (data) => {
                    log.info(`ACC_INB_Callback postConversationDisconnect success! data: ${ucid} ,  ${JSON.stringify(data, null, 2)}`);
                  })
                  .catch(async (err) => {
                    log.error(`ACC_INB_Callback There was a failure calling postConversationDisconnect : ${ucid}, ${err}`);
                  });


                textCRD += await (ucid + "|"); //UCID
                textCRD += await (customerphoneNumber + "|"); //Customer
                textCRD += await (moment(conversationstartTime).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                textCRD += await (agentcode + "|"); //Agent Code
                textCRD += await "ACC"
                textCRD += await "\n";
                break;
              }
            }
          }
        })
        .catch(async (err) => {
          console.log("There was a failure calling getConversationsCall");
          console.error(err);
        });
    }
  }
  log.info(`====== parserCDR_ACC_CALLBACK->Done! =======`);
  return textCRD;
};

let GenAbandonOutbound = async () => {

  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

      let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.ACC_OUTB_VDN);
      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let dataQueueIdObj = await ACC_OUT_ABANDON_GetQueueIdInDataTableByID(dataTableId);
        console.log("dataTableId : " + dataTableId);
        console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await ACC_L_ABANDON_OUTBOUND(dataQueueIdObj);

      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });

  log.info("End Process Gen Call Back ACC Outbound :" + await new Date());
};


let GenCallBackOutbound = async () => {

  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

      let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.ACC_OUTB_VDN);
      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let dataQueueIdObj = await ACC_CALLBACK_GetQueueIdInDataTableByID(dataTableId);
        console.log("dataTableId : " + dataTableId);
        console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await ACC_L_CALLBACK_OUTBOUND(dataQueueIdObj);

      }
    })
    .catch((error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });

  log.info("End Process Gen Call Back ACC Outbound :" + await new Date());
};


let ACC_L_ABANDON_OUTBOUND = async (dataQueueIdObj) => {

  let pDateStart = moment().subtract(config.GENESES.data_query_ABANDON_OUTB_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

  if (pDate != null) {
    pDateStart = moment(pDate + "T00:00:00.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    pDateStop = moment(pDate + "T23:59:59.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  }


  let pageTotal = 2;
  let dataResult;
  let conversationObj;

  let body = {
    interval: pDateStart + "/" + pDateStop,
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

  // log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body )}` );
  pageTotal = 2;
  dataResult;

  dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
  // log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

  if (
    (await dataResult) !== undefined &&
    (await dataResult.totalHits) > 0
  ) {
    conversationObj = await dataResult;
    pageTotal = Math.ceil(dataResult.totalHits / 100);

    for (let i = 1; i < pageTotal; i++) {
      body.paging.pageNumber = i + 1;
      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      // `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
      Array.prototype.push.apply(
        conversationObj.conversations,
        dataResult.conversations
      );
    } //end for

    let lineCDR = await parserCDR_ACC_L_ABANDON_OUTBOUND(conversationObj, dataQueueIdObj);
    if (await lineCDR.length > 98) {
      // await dbservice.insertIvrAccVoicemail(lineCDR.split("\n"));
      const localPath = await `${config.GENESES.data_process_inbox}/L_ABANDON_INBOUND_${moment().format("YYYYMMDD_HHmmss")}.txt`;
      await writeFile(localPath, lineCDR);
      await ftpFileCDR(localPath);
    }
  }
};

let ACC_L_CALLBACK_OUTBOUND = async (dataQueueIdObj) => {

  let pDateStart = moment().subtract(config.GENESES.data_query_CALLBACK_OUTBOUND_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

  if (pDate != null) {
    pDateStart = moment(pDate + "T00:00:00.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    pDateStop = moment(pDate + "T23:59:59.000").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  }


  let pageTotal = 2;
  let dataResult;
  let conversationObj;

  let body = {
    interval: pDateStart + "/" + pDateStop,
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

  pageTotal = 2;
  dataResult;

  dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);

  if (
    (await dataResult) !== undefined &&
    (await dataResult.totalHits) > 0
  ) {
    conversationObj = await dataResult;
    pageTotal = Math.ceil(dataResult.totalHits / 100);

    for (let i = 1; i < pageTotal; i++) {
      body.paging.pageNumber = i + 1;
      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      Array.prototype.push.apply(
        conversationObj.conversations,
        dataResult.conversations
      );
    } //end for

    let lineCDR = await parserCDR_ACC_L_CALLBACK_OUTBOUND(conversationObj, dataQueueIdObj);
    if (await lineCDR.length > 98) {
      const localPath = await `${config.GENESES.data_process_inbox}/L_CALLBACK_INBOUND_${moment().format("YYYYMMDD_HHmmss")}.txt`;
      await writeFile(localPath, lineCDR);
      await ftpFileCDR(localPath);
    }
  }
};

let parserCDR_ACC_L_ABANDON_OUTBOUND = async (data, dataQueueIdObj) => {
  await log.info(`====== parserCDR_ACC_L_ABANDON_OUTBOUND->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO";
  let textCRD = await '';

  for (const item of data.conversations) {

    if (isTransactionCaptureByQueue(item.participants, dataQueueIdObj)) {
      if (await istAbandon(item.participants)) {
        textCRD += (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1]) + "|"); //CALLING_PTY
        textCRD += "P|"; //STATUS
        textCRD += moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //IMPORT_DATE
        textCRD += moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //CHG_TIME
        textCRD += (item.conversationId + "|"); //CALLID
        textCRD += (moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
        textCRD += (moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTOP
        textCRD += "3|"; //DISPOSITION
        textCRD += (parserPhoneNumber(item.participants[0].sessions[0].dnis.split(":")[1]) + "|"); //DISPVDN
        textCRD += (item.conversationId + "|"); //UCID
        textCRD += 999;
        textCRD += "\n";
      }
    }
  }

  await log.info(`====== parserCDR_ACC_L_ABANDON_OUTBOUND->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};


let parserCDR_ACC_L_CALLBACK_OUTBOUND = async (data, dataQueueIdObj) => {
  await log.info(`====== parserCDR_ACC_L_CALLBACK_OUTBOUND->Begin =======`);

  let cdrHeader = await "CALLING_PTY|STATUS|IMPORT_DATE|CHG_TIME|CALLID|SEGSTART|SEGSTOP|DISPOSITION|DISPVDN|UCID|ROUND_NO";
  let textCRD = await '';

  for (const item of data.conversations) {

    if (isTransactionCaptureByQueue(item.participants, dataQueueIdObj)) {

      await apiInstance.getConversationsCall(item.conversationId)
        .then(async (data) => {
          if (
            (await data) !== undefined &&
            (await data.participants) !== undefined &&
            (await data.participants.length) > 0
          ) {
            for (let index_p = 0; index_p < data.participants.length; index_p++) {
              let participant = await data.participants[index_p];
              //log.info( `API->postAnalyticsConversationsDetailsQuery(), Result: ${JSON.stringify(data)}` );
              if (
                (await participant) !== undefined &&
                (await participant.attributes) !== undefined &&
                (await participant.attributes.CB_INFO) !== undefined &&
                (await participant.attributes.CB_INFO) != ''
              ) {
                let conversationId = item.conversationId;

                await apiInstance.postConversationDisconnect(conversationId)
                  .then(async (data) => {
                    console.log(`ACC_OUTB_Callback postConversationDisconnect success! data: ${conversationId} ,  ${JSON.stringify(data, null, 2)}`);
                    log.info(`ACC_OUTB_Callback postConversationDisconnect success! data: ${conversationId} ,  ${JSON.stringify(data, null, 2)}`);
                  })
                  .catch(async (err) => {
                    console.log(`ACC_OUTB_Callback There was a failure calling postConversationDisconnect : ${conversationId}`);
                    console.error(err);
                  });
                //ratchawin
                textCRD += (parserPhoneNumber(item.participants[0].sessions[0].ani.split(":")[1]) + "|"); //CALLING_PTY
                textCRD += "P|"; //STATUS
                textCRD += moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //IMPORT_DATE
                textCRD += moment().format("YYYY-MM-DD HH:mm:ss") + "|"; //CHG_TIME
                textCRD += (item.conversationId + "|"); //CALLID
                textCRD += (moment(item.conversationStart).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                textCRD += (moment(item.conversationEnd).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTOP
                textCRD += "3|"; //DISPOSITION
                textCRD += (parserPhoneNumber(item.participants[0].sessions[0].dnis.split(":")[1]) + "|"); //DISPVDN
                textCRD += (item.conversationId + "|"); //UCID
                textCRD += 999;
                textCRD += "\n";
                break;
              }
            }
          }
        })
        .catch(async (err) => {
          console.log("There was a failure calling getConversationsCall");
          console.error(err);
        });



    }
  }

  await log.info(`====== parserCDR_ACC_L_CALLBACK_OUTBOUND->Done! =======`);
  return await (cdrHeader + '\n' + textCRD);
};

//========================Internal-Function===========================
let writeFile = async (path, content) => {
  log.info(`====== writeFile, path=${path}`);
  await fs.writeFileSync(path, content, { encoding: 'utf8', flag: 'w' })
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
let isTransactionCaptureByQueue = (data_participants, dataQueueIdObj) => {
  for (const item of data_participants) {
    for (const obj of item.sessions[0].segments) {
      if (obj.queueId !== undefined) {
        for (const queue_id of dataQueueIdObj) {
          if (obj.queueId === queue_id) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

let isTransactionCaptureVoicemailByQueue = (data_participants, dataQueueIdObj) => {
  for (const item of data_participants) {
    for (const obj of item.sessions[0].segments) {
      if (obj.queueId !== undefined) {
        for (const queue_id of dataQueueIdObj) {
          if (obj.queueId === queue_id) {
            log.info(obj.queueId + ' = ' + queue_id);
            return [true, queue_id];
          }
        }
      }
    }
  }

  return [false, ''];
};


let getDataTableByName = async (name) => {

  let dataTableObj;

  let apiInstance = new platformClient.ArchitectApi();

  let opts = {
    "expand": "expand_example", // String | Expand instructions for the result
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "sortBy": "id", // String | Sort byvision ID(s)
    "name": name // String | Filter by Name. The wildcard character * is supported within the filter. Matches are case-insensitive.
  };

  // Retrieve a list of datatables for the org
  await apiInstance.getFlowsDatatables(opts)
    .then(async (data) => {
      dataTableObj = await data;
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatables");
      console.error(err);
    });



  return dataTableObj;
};

let CallbackGetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];


  let apiInstance = new platformClient.ArchitectApi();
  let pageTotal = 2;
  let datatableId = id; // String | id of datatable
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "showbrief": false, // Boolean | If true returns just the key value of the row
    "sortOrder": "ascending" // String | Sort order
  };

  // Returns the rows for the datatable with the given id
  await apiInstance.getFlowsDatatableRows(datatableId, opts)
    .then(async (dataResult) => {
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        dataTableObj = await dataResult;
        pageTotal = Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            dataTableObj.entities,
            dataResult.entities
          );
        } //end for

        for (let i = 0; i < dataTableObj.total; i++) {

          if (
            (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
            (await dataTableObj.entities[i].QUEUE_ID) != '' &&
            (await dataTableObj.entities[i].CALLBACK_ENABLE) == true
          ) {
            var queueId = await dataTableObj.entities[i].QUEUE_ID;
            dataQueueIdObj.push(queueId);
          }
        }
      }
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
    });

  return dataQueueIdObj;

};

let VoicemailGetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  let apiInstance = new platformClient.ArchitectApi();
  let pageTotal = 2;
  let datatableId = id; // String | id of datatable
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "showbrief": false, // Boolean | If true returns just the key value of the row
    "sortOrder": "ascending" // String | Sort order
  };

  // Returns the rows for the datatable with the given id
  await apiInstance.getFlowsDatatableRows(datatableId, opts)
    .then(async (dataResult) => {
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        dataTableObj = await dataResult;
        pageTotal = Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await apiInstance.getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            dataTableObj.entities,
            dataResult.entities
          );
        } //end for

        for (let i = 0; i < dataTableObj.total; i++) {

          if (
            (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
            (await dataTableObj.entities[i].QUEUE_ID) != '' &&
            (await dataTableObj.entities[i].VOICEMAIL_ENABLE) == true
          ) {
            var queueId = await dataTableObj.entities[i].QUEUE_ID;
            dataQueueIdObj.push(queueId);
          }
        }
      }
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
    });

  return dataQueueIdObj;

};

let GetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  let apiInstance = new platformClient.ArchitectApi();
  let pageTotal = 2;
  let datatableId = id; // String | id of datatable
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "showbrief": false, // Boolean | If true returns just the key value of the row
    "sortOrder": "ascending" // String | Sort order
  };

  // Returns the rows for the datatable with the given id
  await apiInstance.getFlowsDatatableRows(datatableId, opts)
    .then(async (dataResult) => {
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        dataTableObj = await dataResult;
        pageTotal = Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await apiInstance.getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            dataTableObj.entities,
            dataResult.entities
          );
        } //end for

        for (let i = 0; i < dataTableObj.total; i++) {

          if (
            (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
            (await dataTableObj.entities[i].QUEUE_ID) != '' &&
            (await dataTableObj.entities[i].VOICEMAIL_ENABLE) == true
          ) {
            var queueId = await dataTableObj.entities[i].QUEUE_ID;
            dataQueueIdObj.push(queueId);
          }
        }
      }
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
    });

  return dataQueueIdObj;

};


let ACC_OUT_ABANDON_GetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  let apiInstance = new platformClient.ArchitectApi();
  let pageTotal = 2;
  let datatableId = id; // String | id of datatable
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "showbrief": false, // Boolean | If true returns just the key value of the row
    "sortOrder": "ascending" // String | Sort order
  };

  // Returns the rows for the datatable with the given id
  await apiInstance.getFlowsDatatableRows(datatableId, opts)
    .then(async (dataResult) => {
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        dataTableObj = await dataResult;
        pageTotal = Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await apiInstance.getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            dataTableObj.entities,
            dataResult.entities
          );
        } //end for

        for (let i = 0; i < dataTableObj.total; i++) {

          if (
            (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
            (await dataTableObj.entities[i].QUEUE_ID) != '' &&
            (await dataTableObj.entities[i].GEN_FILE_ABANDON_ENABLE) == true
          ) {
            var queueId = await dataTableObj.entities[i].QUEUE_ID;
            dataQueueIdObj.push(queueId);
          }
        }
      }
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
    });

  return dataQueueIdObj;

};


let ACC_CALLBACK_GetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  let apiInstance = new platformClient.ArchitectApi();
  let pageTotal = 2;
  let datatableId = id; // String | id of datatable
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100, // Number | Page size
    "showbrief": false, // Boolean | If true returns just the key value of the row
    "sortOrder": "ascending" // String | Sort order
  };

  // Returns the rows for the datatable with the given id
  await apiInstance.getFlowsDatatableRows(datatableId, opts)
    .then(async (dataResult) => {
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        dataTableObj = await dataResult;
        pageTotal = Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await apiInstance.getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            dataTableObj.entities,
            dataResult.entities
          );
        } //end for

        for (let i = 0; i < dataTableObj.total; i++) {

          if (
            (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
            (await dataTableObj.entities[i].QUEUE_ID) != '' &&
            (await dataTableObj.entities[i].CALLBACK_ENABLE) == true
          ) {
            var queueId = await dataTableObj.entities[i].QUEUE_ID;
            dataQueueIdObj.push(queueId);
          }
        }
      }
    })
    .catch((err) => {
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
    });

  return dataQueueIdObj;

};

let ftpFileCDR = async (localPath) => {
  log.info("ftpFileCDR(), Begin... Uploading...");
  sftp
    .connect({
      host: config.SFTP_ACC_OUT_CALLBACK.host,
      port: config.SFTP_ACC_OUT_CALLBACK.port,
      username: config.SFTP_ACC_OUT_CALLBACK.username,
      password: config.SFTP_ACC_OUT_CALLBACK.password,
    })
    .then(() => {
      return sftp.put(
        localPath,
        `${config.SFTP_ACC_OUT_CALLBACK.remote_path}/${path.basename(localPath)}`
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

let moveFile = async (srcFile) => {
  const destFile = await `${config.SFTP_ACC_OUT_CALLBACK.local_outbox_path}/${moment().format(
    "YYYYMMDD_HHmmss"
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

let istAbandon = (data_participants) => {
  for (const item of data_participants) {
    if ((item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if (obj.name === "tAbandon") {
          return true;
        }
      }
    }
  }
  return false;
};


let convertData = (text) => {
  if (
    (text) == undefined
  ) {
    return '';
  } else {
    return text;
  }

};

let WorkingTimeCheck = () => {

  const PresentTime = moment().subtract(1, 'hour').format('HH:mm');

  if (PresentTime < config.GENESES.DATA_QUERY_START_WORKING_HOUR || PresentTime > config.GENESES.DATA_QUERY_END_WORKING_HOUR) {
    return true;
  } else {
    return false;
  }

};

let FilterMessageId = (conversationId, dataMessageObj) => {
  let messageid = '';
  for (const item of dataMessageObj) {
    if (item.conversation.id === conversationId) {
      messageid = item.id;
      break;
    }
  }
  return messageid;
};

let Manual_ACC_INB_Callback = async (pDateIn) => {
  pDate = pDateIn;
  Gen_ACC_CALLBACK();
};

let Manual_ACC_OUTB_Callback = async (pDateIn) => {
  pDate = pDateIn;
  GenCallBackOutbound();
};

let Manual_ACC_OUTB_Abandon = async (pDateIn) => {
  pDate = pDateIn;
  GenAbandonOutbound();
};

let Manual_ACC_Voicemail = async (pDateIn) => {
  pDate = pDateIn;
  Gen_ACC_VOICEMAIL();
};

module.exports = {
  Gen_ACC_VOICEMAIL,
  Gen_ACC_CALLBACK,
  GenCallBackOutbound,
  GenAbandonOutbound,
  Manual_ACC_INB_Callback,
  Manual_ACC_OUTB_Callback,
  Manual_ACC_Voicemail,
  Manual_ACC_OUTB_Abandon
};
