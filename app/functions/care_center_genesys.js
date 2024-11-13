const Client = require("ssh2-sftp-client");
const sftp = new Client();
const log = require("./logger.js").LOG;
const fs = require("node:fs");
const moment = require('moment-timezone');
const path = require("path");
//const moment = require("moment");
const config = require("../config/care_center_server.js");
const genesys = require("../config/genesys_server.js");
const dbservice = require('./care_center_dbservice');

const salesForceService = require("./sales_force_service.js");

const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();
const voiceApi = new platformClient.VoicemailApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = genesys.GENESES.client_id;
const CLIENT_SECRET = genesys.GENESES.client_secret;
client.setEnvironment(genesys.GENESES.org_region);

let pDate = null;
let environment ='';


let ManualGenAbandonCareCenter = async (pDateIn,env) => {
  pDate = pDateIn;
  await genAbandonCareCenter(env);
};

let getGetListOfQueues = async () => {

  let listOfQueues;

  let apiInstance = new platformClient.RoutingApi();

  let pageTotal = 2;
  let opts = {
    "pageNumber": 1, // Number | Page number
    "pageSize": 100 // Number | Page size
  };

  await apiInstance.getRoutingQueues( opts)
    .then(async (dataResult) => {
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        listOfQueues = await dataResult;
        pageTotal = await Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await apiInstance.getRoutingQueues(opts)
          await Array.prototype.push.apply(
            listOfQueues.entities,
            dataResult.entities
          );
        } //end for


      }
    })
    .catch(async (err) => {
      console.log("There was a failure calling getGetListOfQueues");
      console.error(err);
    });

  return listOfQueues;

};

let genAbandonCareCenter = async (env) => {

  environment = env;

  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {

      console.log("loginClientCredentialsGrant : ");

      let listOfQueues = await getGetListOfQueues();
      let dataTableObj = await getDataTableByName(config.GENESES.GEN_ABANDON_DATA_TABLE.NAME);

      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let rowDataObj = await getRowDataInDataTableByID(dataTableId);
        let dataQueueIdObj = await getInfomationQueueAbandon(rowDataObj);
       
        for (const key in dataQueueIdObj) {
          if (dataQueueIdObj.hasOwnProperty(key)) {
            const name = listOfQueues.entities.find(element => element.id === key).name;
            dataQueueIdObj[key] = name;
          }
        }
        
        console.log("dataTableId : " + dataTableId);
        console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await analyticsAbandonConversationsDetailsAndGenFile(dataQueueIdObj);

      }

    })
    .catch(async (error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
    log.info("End Process gen Abandon Care Center :"+await new Date() );
};

let analyticsAbandonConversationsDetailsAndGenFile = async (dataQueueIdObj) => {

  var pDateStart = moment().add(-config.GENESES.data_query_ABANDON_period, "minute");
  var pDateStop = moment();

  if(pDate != null){
    pDateStart = moment(pDate + "T00:00:00.000");
    pDateStop = moment(pDate + "T23:59:59.000");
  }

  console.log("pDateStart : "+ pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
  console.log("pDateStop : "+ pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));

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

    let dataAbandonList = await parserAbandonDetail(conversationObj, dataQueueIdObj);
    if (await dataAbandonList.length > 0) {
       
        await saveAbandonCallToSalesforce(dataAbandonList);
      // await ftpFileCDR(localPath);
    }
  }
};

let saveAbandonCallToSalesforce = async (dataAbandonList) => {
  log.info( `CC dataAbandonList Result: ${JSON.stringify(dataAbandonList)}` );
  await salesForceService.callApiSaveAbandonCallSalesforce(dataAbandonList,environment);
  log.info("CC saveAbandonCallToSalesforce Done");
};


let parserAbandonDetail = async (data, dataQueueIdObj) => {
  await log.info(`====== parserAbandonDetail->Begin =======`);



  const dataAbandonList = [];
  for (const item of data.conversations) {

    const queueName = await isTransactionAbandonInboundCaptureByQueue(item.participants, dataQueueIdObj);

    if ( await queueName != '') {

        let tNotResoindingList = await tNotResoinding(item.participants);

        if(tNotResoindingList.length == 0){
          continue;
        }

        let userId =tNotResoindingList[0].userId;
        let apiInstanceUsersApi = new platformClient.UsersApi();
        let opts = { 
        };
        

        let conversationId = item.conversationId;
        await apiInstance.getConversationsCall(conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
          .then(async (data) => {
            if (
              (await data) !== undefined &&
              (await data.participants) !== undefined &&
              (await data.participants.length) > 0
            ) {

              for (let index_p = 0; await index_p < data.participants.length; await index_p++) {
                let participant = await data.participants[index_p];

                if (
                  (await participant) !== undefined 
                  && (await participant.attributes)  !== undefined 
                  && (await participant.attributes["DNIS_NUMBER"])  !== undefined 
                ) {

                  let userName = '';
                  // Get user.
                  await apiInstanceUsersApi.getUser(userId, opts)
                  .then(async (data) => {
                    let email = data.email;
                    userName = email.substring(0, email.indexOf('@'));
                  })
                  .catch(async (err) => {
                    log.error(`There was a failure calling getUser , ${err}`);
                    
                  });

                  let SEGSTART = await moment(item.conversationStart) ; //SEGSTART
                  let SEGSTOP = await moment(item.conversationEnd) ; //SEGSTOP

                  // คำนวณความแตกต่างระหว่าง SEGSTART และ SEGSTOP
                  let duration = await moment.duration(SEGSTOP.diff(SEGSTART));

                  // แปลงเป็น hh:mm:ss
                  let callDuration = await moment.utc(duration.asMilliseconds()).format("HH:mm:ss");


                  // คำนวณจำนวน นาที และ วินาที
                  let minutes = Math.floor(duration.asMinutes());
                  let seconds = Math.floor(duration.asSeconds()) % 60;

                  // รวมเข้าด้วยกันในรูปแบบ MM.SS
                  let formattedDuration = `${minutes}.${String(seconds).padStart(2, '0')}`;

                  // แปลงเป็นตัวเลขประเภท double (18, 2)
                  let doubleDuration = parseFloat(formattedDuration);
                  
                  let differenceInMilliseconds = SEGSTOP - SEGSTART;
                  // แปลงระยะเวลาเป็นวินาที
                  let differenceInSeconds = Math.floor(differenceInMilliseconds / 1000);

                  //console.log(`Duration in seconds: ${differenceInSeconds}`);

                  //console.log("//////////////");
                  //console.log(participant.attributes);
                  //console.log("//////////////");

                  let conversationStart = new Date(item.conversationStart).toISOString().replace('Z', '+0000');
                  let conversationEnd = new Date(item.conversationEnd).toISOString().replace('Z', '+0000');

                  //let conversationStart = await moment(item.conversationStart).format('YYYY-MM-DDTHH:mm:ss.SSS+0000');
                  //let conversationEnd = await moment(item.conversationEnd).format('YYYY-MM-DDTHH:mm:ss.SSS+0000');


                  let uui = participant.attributes["UUI"] === undefined ? "" : participant.attributes["UUI"];
                  if(uui == ''){
                    uui = "||||"
                  }

                  let countPipe  = await uui.split('|').length - 1;
                  let checkAddList = true;

                  let ANI_NUMBER = participant.attributes["ANI_NUMBER"] === undefined ? "" : participant.attributes["ANI_NUMBER"];
                  let DNIS_NUMBER = participant.attributes["DNIS_NUMBER"] === undefined ? "" : participant.attributes["DNIS_NUMBER"];
                  let IVR_DNIS = participant.attributes["IVR_DNIS"] === undefined ? "" : participant.attributes["IVR_DNIS"];
                  
                  let CX_CALLED = participant.attributes["CX_CALLED"] === undefined ? "" : participant.attributes["CX_CALLED"];
                  let transfer_InternalVDN = participant.attributes["transfer_InternalVDN"] === undefined ? "" : participant.attributes["transfer_InternalVDN"];
                  transfer_InternalVDN = await transfer_InternalVDN.replace('+', '');
                  
                  ANI_NUMBER = await parserTelPhoneNumber(ANI_NUMBER);
                  DNIS_NUMBER = await parserTelPhoneNumber(DNIS_NUMBER);
                  
                  ANI_NUMBER = await parserPhoneNumber(ANI_NUMBER);
                  DNIS_NUMBER = await parserPhoneNumber(DNIS_NUMBER);
                  IVR_DNIS = await parserPhoneNumber(IVR_DNIS);

                  IVR_DNIS = await IVR_DNIS.replace('+', '');
                  DNIS_NUMBER = await DNIS_NUMBER.replace('+', '');

                  if(await countPipe >=3){
                    let uuiSplit =  uui.split('|');

                    if(CX_CALLED != ''){
                      uui = uuiSplit[0]+'|'+uuiSplit[1]+'|'+uuiSplit[2]+'|'+uuiSplit[3]+"|"+IVR_DNIS
                    }else{
                      uui = uuiSplit[0]+'|'+uuiSplit[1]+'|'+uuiSplit[2]+'|'+uuiSplit[3]+"|"+DNIS_NUMBER
                    }

                    
                  }else if(await countPipe <3){
                    checkAddList = false;
                  }

                  if(checkAddList){
                    if ((ANI_NUMBER.startsWith("0") && ANI_NUMBER.length >= 9) || CX_CALLED != '' ) {
                      checkAddList = true;
                    } else {
                      checkAddList = false;
                    }
                  }

                  if(checkAddList){
                    if ( (DNIS_NUMBER.startsWith("0") && DNIS_NUMBER.length >= 9)
                      || DNIS_NUMBER.length == 5 || DNIS_NUMBER.length == 4) {
                      checkAddList = true;
                    } else {
                      checkAddList = false;
                    }
                  }

                  if(CX_CALLED != ''){
                    if( transfer_InternalVDN != ''){
                      DNIS_NUMBER = transfer_InternalVDN;
                    }else{
                      DNIS_NUMBER = '47'+CX_CALLED;
                    }
                  }
                  
                  if (checkAddList ) {
                    
                    dataAbandonList.push({
                      CallStartTime : conversationStart,
                      CallDurationHHMMSS : callDuration,
                      QueueName : queueName,
                      Caller : ANI_NUMBER,
                      UUI : uui,
                      Called : DNIS_NUMBER,
                      PolicyNumber : participant.attributes["POLICY_NUMBER"] === undefined ? "" : participant.attributes["POLICY_NUMBER"],
                      AgentCode : participant.attributes["AGENT_CODE"] === undefined ? "" : participant.attributes["AGENT_CODE"],
                      Conversation_Id : conversationId,
                      PINCodeResult : participant.attributes["AGENT_PINCODE"] === undefined ? "" : participant.attributes["AGENT_PINCODE"],
                      IVRLastMenuName : participant.attributes["IVR_LASTMENU"] === undefined ? "" : participant.attributes["IVR_LASTMENU"],
                      UUI_B_Number : IVR_DNIS,
                      Call_Duration_MM_SS : doubleDuration,
                      CallDisposition : "Abandon",
                      CallDurationInSeconds : differenceInSeconds,
                      Closed_Date_Time : conversationEnd,
                      CompletedDateTime : conversationEnd,
                      Opened_Date_Time : conversationStart,
                      GenesysUser : userName //'agentAppTest'
                  });
                  //console.log(dataAbandonList.length +' Conversation_Id :' + conversationId +' ,SEGSTOP :'+SEGSTOP);
                }
                                  
                  //console.log("//////////////");
                  if(dataAbandonList.length >=100  &&  dataAbandonList.length% 100 == 0){
                    console.log("Wait for 20 seconds Rate limit exceeded the maximum api Genesys");
                    await delay(30000);
                  }
                  
                  break;
                }
              }
            }
          })
          .catch(async (err) => {
            log.error(`There was a failure calling getConversationsCall , ${err}`);
            
          });
    }
  }
  
  await log.info( 'cc dataAbandonList Size :'+dataAbandonList.length );
  await log.info(`cc ====== parserAbandonDetail->Done! =======`);
  return await dataAbandonList;
};

let Gen_CARE_VOICEMAIL = async () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("loginClientCredentialsGrant : ");

  let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.NAME_CC);
  if(await dataTableObj.total > 0){
    let dataTableId = await dataTableObj.entities[0].id;
    
    let dataQueueIdObj = await VoicemailGetQueueIdInDataTableByID(dataTableId);
    log.info("dataTableId : "+dataTableId);
    log.info(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

    await CARE_VOICEMAIL(dataQueueIdObj);

  }
})
.catch(async (error) => {
  log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
});
  log.info("End Process Gen_CARE_VOICEMAIL :"+await new Date() );
};

let CARE_VOICEMAIL = async (dataQueueIdObj) => {
      
      let pDateStart = moment().subtract(config.GENESES.data_query_voicemail_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

      if(pDate != null){
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

        let lineCDR = await parserCDR_CARE_VOICEMAIL(conversationObj,dataQueueIdObj);
        if (await lineCDR.length > 0) {
          await dbservice.insertIvrCareVoicemail(lineCDR.split("\n"));
          
        }
      }
};

let parserCDR_CARE_VOICEMAIL = async (data,dataQueueIdObj) => {
  //log.info( `======***parserCDR_BY_Queue_LIST***, Raw-Data= ${JSON.stringify(data)}` );
  log.info(`====== parserCDR_CARE_VOICEMAIL->Begin =======`);

  let textCRD = '';

  for (const item of data.conversations) {

    const voicemailValue = isTransactionCaptureVoicemailByQueue(item.participants,dataQueueIdObj);
    const VoiceValueFirst = voicemailValue[0];
    const VoiceValueSecond = voicemailValue[1];

    if (VoiceValueFirst) {
              //getVoicemail

              let MessageResult = await voiceApi.getVoicemailQueueMessages(VoiceValueSecond);
              let message_id = await FilterMessageId(item.conversationId,MessageResult.entities);

              // Get call conversation
              await apiInstance.getConversationsCall(item.conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
                .then(async (data) => {
                  if (
                    (await data) !== undefined &&
                    (await data.participants)  !== undefined &&
                    (await data.participants.length) > 0
                  ) {
                    for(let index_p = 0 ;index_p < data.participants.length ; index_p++){
                      let participant = await data.participants[index_p];
                      // log.info( `API->postAnalyticsConversationsDetailsQuery(), Result: ${JSON.stringify(data)}` );
                      if (
                        (await participant) !== undefined &&
                        (await participant.attributes)  !== undefined &&
                        (await participant.attributes.VM_INFO)  !== undefined
                          ) {
                          let ucid = item.conversationId;
                          let customerphoneNumber = parserPhoneNumber(participant.ani.split(":")[1] );
                          let conversationstartTime = await convertData(participant.startTime);
                          let policyNumber = await convertData(participant.attributes.POLICY_NUMBER);
                          
                          await apiInstance.postConversationDisconnect(ucid)
                          .then(async (data) => {
                            log.info(`CARE_VOICEMAIL postConversationDisconnect success! data: ${ucid} ,  ${JSON.stringify(data, null, 2)}`);
                            
                          })
                          .catch(async (err) => {
                            log.error(`CARE_VOICEMAIL There was a failure calling postConversationDisconnect : ${ucid}, ${err}`);
                            
                          });

                          //log.info('ucid : '+ucid);
                     
                          textCRD += await (ucid + "|"); //UCID
                          textCRD += await (customerphoneNumber + "|"); //Customer
                          textCRD += await (moment(conversationstartTime).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                          textCRD += await (policyNumber + "|"); //Policy No.
                          textCRD += await (message_id + "|");
                          textCRD += await "CC"
                          textCRD += await "\n";
                          break;
                      }
                    }
                  }
                })
                .catch(async (err) => {
                  log.error(`There was a failure calling getConversationsCall , ${err}`);
                  
                });    
    }
  }
  log.info(`====== parserCDR_CARE_VOICEMAIL->Done! =======`);
  return textCRD;
};



let ivrMenuLogGetQueueIdInDataTableByID = async (id) => {

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
        log.info(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
        if (
          (await dataResult) !== undefined &&
          (await dataResult.total) > 0
        ) {
          dataTableObj = await dataResult;
          pageTotal = Math.ceil(dataResult.total / 100);
  
          for (let i = 1; i < pageTotal; i++) {
            opts.pageNumber = i+1;
            dataResult = await getFlowsDatatableRows(datatableId, opts)
            await Array.prototype.push.apply(
              dataTableObj.entities,
              dataResult.entities
            );
          } //end for

          for(let i = 0 ; i < dataTableObj.total ; i++){
           
            if (
              (await dataTableObj.entities[i].key) !== undefined &&
              (await dataTableObj.entities[i].key) != ''
            ){
              var flowId = await dataTableObj.entities[i].key;
              dataQueueIdObj.push(flowId);
            }
          }
        }
      })
      .catch((err) => {
        log.error(`There was a failure calling getFlowsDatatableRows , ${err}` );
        
      });

  return  dataQueueIdObj;

};  


let Gen_IVR_Log = async () => {

  await log.info(`Start Process Gen_IVR_Log:  ${new Date()} `);

    await client
      .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
      .then(async () => {
        log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

        let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_CC_IVR_MENU_LOG.NAME);
        if(await dataTableObj.total > 0){
          let dataTableId = await dataTableObj.entities[0].id;
          let dataQueueIdObj = await ivrMenuLogGetQueueIdInDataTableByID(dataTableId);

          if(dataQueueIdObj.length > 0){
            await Get_IVR_Log(dataQueueIdObj);
          }
          
        }
   
    })
    .catch(async (error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
      

await log.info(`End Process Gen_IVR_Log : ${new Date()} `);

};


let Get_IVR_Log = async (dataQueueIdObj) => {
      
      let pDateStart = moment().subtract(config.GENESES.data_query_ivrlog_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      
      if(pDate != null){
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

        let lineCDR = await parserCDR_IVR_Log(conversationObj,dataQueueIdObj);
        if (await lineCDR.length > 0) {
            const lines = lineCDR.split("\n").filter(line => line.trim() !== '');
            
            for(let i = 0 ;i<lines.length ;i++){
              let data = [];
              data.push(lines[i]);
              await dbservice.insertIvrLog(data);
            }
            
        }
      }
};

let checkFlowIvrLogInDataTable = async (data_participants, dataQueueIdObj) => {
  for (const item of data_participants) {
    let v;
    if (await item.sessions[0].flow !== undefined) {
      if (await item.sessions[0].flow.flowId !== undefined) {
        if (await(dataQueueIdObj.includes(item.sessions[0].flow.flowId))) {
          return true;
        }
      }
    }
  }

  return false;
};

let parserCDR_IVR_Log = async (data,dataQueueIdObj) => {
  
  log.info(`====== parserCDR_IVR_Log->Begin =======`);
  let textCRD = '';
  for (const item of data.conversations) {    

    const isFlowIvrLog = await checkFlowIvrLogInDataTable(item.participants, dataQueueIdObj);
    if(isFlowIvrLog){
      await delay(100);
      
      await apiInstance.getConversationsCall(item.conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
      .then(async (data) => {

        if (
          (await data) !== undefined &&
          (await data.participants)  !== undefined &&
          (await data.participants.length) > 0
        ) {

          for(let index_p = 0 ;index_p < data.participants.length ; index_p++){

            let participant = await data.participants[index_p];

            
            if (
              (await participant) !== undefined &&
              (await participant.attributes)  !== undefined &&
              (await participant.attributes.IVR_MENU_LOG)  !== undefined &&
              (await participant.attributes.IVR_MENU_LOG)  != '' 
            ) {
                  let ucid = data.id;

                  let ivrMenuLogString = participant.attributes.IVR_MENU_LOG;
                  let ivrMenuLogList = ivrMenuLogString.split(';').filter(Boolean);  // Split by ';' and remove empty elements
                  ivrMenuLogList = ivrMenuLogList.map(item => item.split(','));  // Split each part by ','

                  if(ivrMenuLogList.length > 0){
                    for(let indexMenu = 0 ; indexMenu < ivrMenuLogList.length ; indexMenu++){
                      let ivrMenuLog = ivrMenuLogList[indexMenu];
                      if(ivrMenuLog.length == 2){

                        let menucode = ivrMenuLog[1];;
                        let start_time = ivrMenuLog[0];
                        let sequence = await(indexMenu+1);
  
                        // สร้าง Date object จากสตริงวันที่
                        let date = await new Date(start_time);
                        if (isValidDate(date)) {
                          // ดึงค่าต่าง ๆ ของวันที่

                          start_time = await date.toISOString().replace('T', ' ').replace('Z', '');

                          textCRD += await (ucid + "|"); //UCID
                          textCRD += await (menucode + "|"); //MENUCODE
                          textCRD += await (start_time + "|"); //START_TIME
                          textCRD += await (sequence); //SEQUENCE
                          textCRD += await "\n"; 
                        
                        }
                        
                      }
                     
                    }
                  }
              
            }
          }
        }
      })
      .catch(async (err) => {
        log.error(`There was a failure calling getConversationsCall, ${err} `);
        
      }); 

    }

   
  }
  log.info(`====== parserCDR_IVR_Log->Done! =======`);
  return textCRD;
};

function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}
let Gen_CARE_CALLBACK = async () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("loginClientCredentialsGrant : ");
      
  let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE_NAME.NAME_CC);
  if(await dataTableObj.total > 0){
    let dataTableId = await dataTableObj.entities[0].id;
    
    let dataQueueIdObj = await CallbackGetQueueIdInDataTableByID(dataTableId);
    log.info("dataTableId : "+dataTableId);
    log.info(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

    await CARE_CALLBACK(dataQueueIdObj);

  } 
})
.catch(async (error) => {
  log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
});

  await log.info("End Process Gen_CARE_CALLBACK :"+ await new Date() );
};

let CARE_CALLBACK = async (dataQueueIdObj) => {
      
      let pDateStart = moment().subtract(config.GENESES.data_query_callback_period, 'minute').format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      let pDateStop = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      

      if(pDate != null){
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

        let lineCDR = await parserCDR_CARE_CALLBACK(conversationObj,dataQueueIdObj);
        if (await lineCDR.length > 0) {
          await dbservice.insertIvrCareCallback(lineCDR.split("\n"));
          
        }
      }
};

let parserCDR_CARE_CALLBACK = async (data,dataQueueIdObj) => {
  
  log.info(`====== parserCDR_CARE_CALLBACK->Begin =======`);
  let textCRD = '';
  for (const item of data.conversations) {    
    if (isTransactionCaptureByQueue(item.participants,dataQueueIdObj)) {
              // Get call conversation
              await apiInstance.getConversationsCall(item.conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
                .then(async (data) => {
                  if (
                    (await data) !== undefined &&
                    (await data.participants)  !== undefined &&
                    (await data.participants.length) > 0
                  ) {
                    for(let index_p = 0 ;index_p < data.participants.length ; index_p++){
                      let participant = await data.participants[index_p];
                      //log.info( `API->postAnalyticsConversationsDetailsQuery(), Result: ${JSON.stringify(data)}` );
                      if (
                        (await participant) !== undefined &&
                        (await participant.attributes)  !== undefined &&
                        (await participant.attributes.CB_INFO)  !== undefined 
                      ) {
                          let ucid = item.conversationId;
                          let customerphoneNumber = parserPhoneNumber(participant.ani.split(":")[1] );
                          let conversationstartTime = await convertData(participant.startTime);
                          let policyNumber = await convertData(participant.attributes.POLICY_NUMBER);
                          

                          await apiInstance.postConversationDisconnect(ucid)
                          .then(async (data) => {                            
                            log.info(`CC_Callback postConversationDisconnect success! data: ${ucid} ,  ${JSON.stringify(data, null, 2)}`);
                          })
                          .catch(async (err) => {
                            log.error(`CC_Callback There was a failure calling postConversationDisconnect : ${ucid}, ${err}`);
                            
                          });

                          //log.info('ucid : '+ucid);                          

                          textCRD += await (ucid + "|"); //UCID
                          textCRD += await (customerphoneNumber + "|"); //Customer
                          textCRD += await (moment(conversationstartTime).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                          textCRD += await (policyNumber + "|"); //Policy No.
                          textCRD += await "CC"
                          textCRD += await "\n";
                          break;
                      }
                    }
                  }
                })
                .catch(async (err) => {
                  log.error(`There was a failure calling getConversationsCall , ${err}`);
                  
                });    
    }
  }
  log.info(`====== parserCDR_CARE_CALLBACK->Done! =======`);
  return textCRD;
};

let CallbackGetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
  .then(async () => {
    log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
    
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
            opts.pageNumber = i+1;
            dataResult = await getFlowsDatatableRows(datatableId, opts)
            await Array.prototype.push.apply(
              dataTableObj.entities,
              dataResult.entities
            );
          } //end for

          for(let i = 0 ; i < dataTableObj.total ; i++){
           
            if (
              (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
              (await dataTableObj.entities[i].QUEUE_ID) != '' &&
              (await dataTableObj.entities[i].CALLBACK_ENABLE) == true
            ){
              var queueId = await dataTableObj.entities[i].QUEUE_ID;
              dataQueueIdObj.push(queueId);
            }
          }
        }
      })
      .catch((err) => {
        log.error(`There was a failure calling getFlowsDatatableRows, ${err}`);
        
      });

   })
  .catch((error) => {
    log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
  });

  return  dataQueueIdObj;

};

let VoicemailGetQueueIdInDataTableByID = async (id) => {

  let dataTableObj;
  let dataQueueIdObj = [];

  await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
  .then(async () => {
    log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");
    
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
        log.info(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
        if (
          (await dataResult) !== undefined &&
          (await dataResult.total) > 0
        ) {
          dataTableObj = await dataResult;
          pageTotal = Math.ceil(dataResult.total / 100);
  
          for (let i = 1; i < pageTotal; i++) {
            opts.pageNumber = i+1;
            dataResult = await getFlowsDatatableRows(datatableId, opts)
            await Array.prototype.push.apply(
              dataTableObj.entities,
              dataResult.entities
            );
          } //end for

          for(let i = 0 ; i < dataTableObj.total ; i++){
           
            if (
              (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
              (await dataTableObj.entities[i].QUEUE_ID) != '' &&
              (await dataTableObj.entities[i].VOICEMAIL_ENABLE) == true
            ){
              var queueId = await dataTableObj.entities[i].QUEUE_ID;
              dataQueueIdObj.push(queueId);
            }
          }
        }
      })
      .catch((err) => {
        log.error(`There was a failure calling getFlowsDatatableRows , ${err}`);
        
      });

   })
  .catch((error) => {
    log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
  });

  return  dataQueueIdObj;

};  


let isTransactionAbandonInboundCaptureByQueue = async (data_participants, dataQueueIdObj) => {

  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tAbandon") {
          for (const objSegments of item.sessions[0].segments) {
            if (await objSegments.queueId !== undefined) {
              if (await(objSegments.queueId in dataQueueIdObj)) {
                return dataQueueIdObj[objSegments.queueId]
              }
            }
          }
        }
      }
    }
  }
  return '';
};


let isTransactionCaptureByQueue = (data_participants,dataQueueIdObj) => {
  for (const item of data_participants) {
    for (const obj of item.sessions[0].segments) {
      if (obj.queueId !== undefined) {
        for (const queue_id of dataQueueIdObj) {
          if (obj.queueId === queue_id) {
            log.info(obj.queueId+' = '+queue_id);
            return true;
          }
        }
      }
    }
  }

  return false;
};


let tNotResoinding = async (data_participants) => {
  let tNotResoindingList =[];
  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tNotResponding") {
          let data = {};
          data.emitDate = await obj.emitDate;
          data.userId = await item.userId;
          await tNotResoindingList.push(data);
        }
      }
    }
  }

  const hasEmitDate = await tNotResoindingList.some(item => item.emitDate !== undefined);
  if(await hasEmitDate ){
    await tNotResoindingList.sort((a, b) => new Date(b.emitDate) - new Date(a.emitDate));
  }

  return tNotResoindingList;
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
let convertData = (text) => {
  if (
    (text) == undefined
  ){
     return '';
  } else {
    return text;
  }

}

let getInfomationQueueAbandon = async (dataTableObj) => {
  let dataQueueIdObj = {};

  for (let i = 0; i < dataTableObj.total; i++) {

    if (
      (await dataTableObj.entities[i].QUEUE_ID) !== undefined &&
      (await dataTableObj.entities[i].GEN_FILE_ABANDON_ENABLE) !== undefined &&
      (await dataTableObj.entities[i].GEN_FILE_ABANDON_ENABLE) == true &&
      (await dataTableObj.entities[i].QUEUE_ID) != ''
    ) {
      var queueId = await dataTableObj.entities[i].QUEUE_ID;
      var queueName = await dataTableObj.entities[i].QUEUE_NAME; 
      dataQueueIdObj[queueId] = await queueName;
    }
  }
  return dataQueueIdObj;

}

let getRowDataInDataTableByID = async (id) => {

  let rowDataObj;

  log.info("AnalyticsConversationsDetailsQuery->login(), success fully!");

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
      log.info(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
      if (
        (await dataResult) !== undefined &&
        (await dataResult.total) > 0
      ) {
        rowDataObj = await dataResult;
        pageTotal = await Math.ceil(dataResult.total / 100);

        for (let i = 1; i < pageTotal; i++) {
          opts.pageNumber = i + 1;
          dataResult = await getFlowsDatatableRows(datatableId, opts)
          await Array.prototype.push.apply(
            rowDataObj.entities,
            dataResult.entities
          );
        } //end for


      }
    })
    .catch(async (err) => {
      log.error(`There was a failure calling getFlowsDatatableRows , ${err}`);
      
    });

  return rowDataObj;

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
      log.error(`There was a failure calling getFlowsDatatables , ${err}`);
      
    }
    );

  return dataTableObj;
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isTransactionCaptureVoicemailByQueue = (data_participants,dataQueueIdObj) => {
  for (const item of data_participants) {
    for (const obj of item.sessions[0].segments) {
      if (obj.queueId !== undefined) {
        for (const queue_id of dataQueueIdObj) {
          if (obj.queueId === queue_id) {
            log.info(obj.queueId+' = '+queue_id);
            return [true, queue_id];
          }
        }
      }
    }
  }

  return [false, ''];
};

let FilterMessageId = (conversationId,dataMessageObj) => {
  let messageid = '';
  for (const item of dataMessageObj) {
          if (item.conversation.id === conversationId) {
            messageid = item.id;
            break;
        }  
      }
      return messageid;
  };


function findNthOccurrence(str, char, n) {
  let count = 0;
  let index = -1;
  for (let i = 0; i < str.length; i++) {
      if (str[i] === char) {
          count++;
          if (count === n) {
              index = i;
              break;
          }
      }
  }
  return index;
}

let Manual_CC_Callback = async (pDateIn) => {
  pDate = pDateIn;
  Gen_CARE_CALLBACK();
};

let Manual_CC_Voicemail = async (pDateIn) => {
  pDate = pDateIn;
  Gen_CARE_VOICEMAIL();
};

let Manual_Get_IVR_Log = async (pDateIn) => {
  pDate = pDateIn;
  Gen_IVR_Log();
};

module.exports = {
  genAbandonCareCenter,
  Gen_CARE_VOICEMAIL,
  Gen_CARE_CALLBACK,
  Gen_IVR_Log,
  ManualGenAbandonCareCenter,
  Manual_CC_Callback,
  Manual_CC_Voicemail,
  Manual_Get_IVR_Log
};
