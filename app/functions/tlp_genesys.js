

const log = require("./logger.js").LOG;
const moment = require('moment-timezone');
//const moment = require("moment");
const config = require("../config/tlp_server.js");
const genesys = require("../config/genesys_server.js");
const dbservice = require('./tlp_dbservice.js');

const salesForceService = require("./sales_force_service.js");

const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();
const voiceApi = new platformClient.VoicemailApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = genesys.GENESES.client_id;
const CLIENT_SECRET = genesys.GENESES.client_secret;
client.setEnvironment(genesys.GENESES.org_region);

let pDate = null;


let Gen_VOICEMAIL = async () => {
  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      console.log("loginClientCredentialsGrant : ");

    let dataTableObj = await getDataTableByName(config.GENESES.TLP_VDN_TABLE_NAME.NAME);
    if(await dataTableObj.total > 0){
      let dataTableId = await dataTableObj.entities[0].id;
      
      let dataQueueIdObj = await VoicemailGetQueueIdInDataTableByID(dataTableId);
      console.log("dataTableId : "+dataTableId);
      console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

      await VOICEMAIL(dataQueueIdObj);

    }
  })
  .catch(async (error) => {
    log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
  });
  log.info("End Process TLP Gen_VOICEMAIL :"+await new Date() );
};

let VOICEMAIL = async (dataQueueIdObj) => {
      
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

     // log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body )}` );
      pageTotal = 2;
      dataResult;

      dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
      //log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=1, Result: ${JSON.stringify(dataResult)}` );

      if (
        (await dataResult) !== undefined &&
        (await dataResult.totalHits) > 0
      ) {
        conversationObj = await dataResult;
        pageTotal = Math.ceil(dataResult.totalHits / 100);

        for (let i = 1; i < pageTotal; i++) {
          body.paging.pageNumber = i + 1;
          dataResult = await apiInstance.postAnalyticsConversationsDetailsQuery(body);
          //log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
          Array.prototype.push.apply(
            conversationObj.conversations,
            dataResult.conversations
          );
        } //end for

        let lineCDR = await parserCDR_VOICEMAIL(conversationObj,dataQueueIdObj);
        if (await lineCDR.length > 0) {
          await dbservice.insertIvrVoicemail(lineCDR.split("\n"));
        }
      }
};

let parserCDR_VOICEMAIL = async (data,dataQueueIdObj) => {
 // log.info( `======***parserCDR_BY_Queue_LIST***, Raw-Data= ${JSON.stringify(data)}` );
  log.info(`====== TLP parserCDR_VOICEMAIL->Begin =======`);

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

                         
                          textCRD += await (ucid + "|"); //UCID
                          textCRD += await (customerphoneNumber + "|"); //Customer
                          textCRD += await (moment(conversationstartTime).format("YYYY-MM-DD HH:mm:ss") + "|"); //SEGSTART
                          textCRD += await (policyNumber + "|"); //Policy No.
                          textCRD += await (message_id + "|");
                          textCRD += await "TLP"
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
  console.log("====== TLP parserCDR_VOICEMAIL->Done! =======");
  log.info(`====== TLP parserCDR_VOICEMAIL->Done! =======`);
  return textCRD;
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
              (await dataTableObj.entities[i].VOICEMAIL_ENABLE) == true
            ){
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

   })
  .catch((error) => {
    log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
  });

  return  dataQueueIdObj;

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
    }
    );

  return dataTableObj;
};


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


let Manual_Gen_VoiceMail = async (pDateIn) => {
  pDate = pDateIn;
  Gen_VOICEMAIL();
};

module.exports = {
  Gen_VOICEMAIL,
  Manual_Gen_VoiceMail
};
