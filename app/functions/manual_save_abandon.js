const config = require("../config/ucc_server.js");
const genesys = require("../config/genesys_server.js");
const salesForceService = require("./sales_force_service.js");

const path = require('path'); // ใช้โมดูล path เพื่อรวม path และชื่อไฟล์
const fs = require('fs').promises;

const log = require("./logger.js").LOG;
const moment = require('moment-timezone');
const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = genesys.GENESES.client_id;
const CLIENT_SECRET = genesys.GENESES.client_secret;
client.setEnvironment(genesys.GENESES.org_region);

let listConversationId = null;
let environment ='';
let checkDate = false;

let saveAbandonCallToSalesforce = async (dataAbandonList) => {
  log.info( `manual_save_abandon dataAbandonList Result: ${JSON.stringify(dataAbandonList)}` );

  if(!checkDate){
    await salesForceService.callApiSaveAbandonCallSalesforce(dataAbandonList,environment);
  }
  log.info("manual_save_abandon saveAbandonCallToSalesforce Done");
};


function moveFile(fileName) {

  const sourcePath = path.join('./manual_process/data_conversation_aban', fileName); // กำหนด path ไฟล์

  const destinationPath = path.join('./manual_process/done_data_conversation_aban', moment().format("YYYYMMDD_HHmmss"))+'_'+fileName; // กำหนด path ไฟล์
  return new Promise((resolve, reject) => {
      fs.rename(sourcePath, destinationPath, (err) => {
          if (err) {
              reject(`Error moving the file: ${err.message}`);
          } else {
              resolve('File moved successfully!');
          }
      });
  });
}


let checkManualGenAbandon = async (fileName,env) => {
  environment = env;
  checkDate = true;
  await readFileLines(fileName);
  await genAbandonByFile(env);
};

let ManualGenAbandon = async (fileName,env) => {
  environment = env;
  await readFileLines(fileName);
  await genAbandonByFile(env);
  await moveFile(fileName);
};


async function readFileLines(fileName) {
  try {
    const filePath = path.join('./manual_process/data_conversation_aban', fileName); // กำหนด path ไฟล์
    const data = await fs.readFile(filePath, 'utf8');
    listConversationId = await  data.replace(/\r/g, '').split('\n'); // ลบ \r และแบ่งเป็นบรรทัด
    log.info(`Lines: ${listConversationId} `);
  } catch (err) {
    log.error(`Error reading file: ${err}`);
  }
}



let genAbandonByFile = async (env) => {

  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {

      log.info("loginClientCredentialsGrant : ");

      await analyticsAbandonConversationsDetails();
    })
    .catch(async (error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
    log.info("End Process gen Abandon Care Center :"+await new Date() );

};


let analyticsAbandonConversationsDetails = async () => {

  var pDateStart = moment().add(-30, "day");
  var pDateStop = moment();


  console.log("pDateStart : "+ pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
  console.log("pDateStop : "+ pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));

  let pageTotal = 2;
  let dataResult;
  let conversationObj;

  let body = {
    interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
    conversationFilters: [
      {
        predicates: [],
        type: "or",
      },
    ],
    paging: {
      pageSize: 100,
      pageNumber: 1,
    },
    order: "asc",
  };


  for (const [index, conversationId] of listConversationId.entries()) {
    log.info(`Line ${index + 1}:`, conversationId); // พิมพ์บรรทัดและตำแหน่งของบรรทัด

    body.conversationFilters[0].predicates.push({type:"dimension" , dimension: "conversationId",operator : "matches" , value: conversationId  });
  }

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

    let dataAbandonList = await parserAbandonDetail(conversationObj);
    if (await dataAbandonList.length > 0) {
       
        await saveAbandonCallToSalesforce(dataAbandonList);
      
    }
  }
};

let isTransactionAbandonInboundCaptureByQueue = async (data_participants, listOfQueues) => {

  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tAbandon") {
          for (const objSegments of item.sessions[0].segments) {
            if (await objSegments.queueId !== undefined) {
              if (await(listOfQueues.find(item => item.id === objSegments.queueId )  !== undefined)) {
                return listOfQueues.find(item => item.id === objSegments.queueId ).name
              }
            }
          }
        }
      }
    }
  }
  return '';
};

let parserAbandonDetail = async (data) => {
  
  await log.info(`====== manual_save_abandon parserAbandonDetail->Begin =======`);
  log.info("/////parserAbandonDetail/////////");

  let listOfQueues = await getGetListOfQueues();
  listOfQueues = listOfQueues.entities
  const dataAbandonList = [];
  for (const item of data.conversations) {

    const queueName = await isTransactionAbandonInboundCaptureByQueue(item.participants,listOfQueues);

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

              for (let index_p = 0; index_p < data.participants.length; index_p++) {
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
                    console.log("There was a failure calling getUser");
                    console.error(err);
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
                    uui = "||||";
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
                  
                }else{
                  log.info("ConversationId Not add :"+conversationId);
                }
                 
                  if(dataAbandonList.length >=100  &&  dataAbandonList.length% 100 == 0){
                    log.info("Wait for 30 seconds Rate limit exceeded the maximum api Genesys");
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
  
  await log.info( 'manual_save_abandon dataAbandonList Size :'+dataAbandonList.length );
  await log.info(`====== manual_save_abandon parserAbandonDetail->Done! =======`);
  return await dataAbandonList;
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
      log.error(`There was a failure calling getGetListOfQueues , ${err}`);
      
    });

  return listOfQueues;

};


let tNotResoinding = async (data_participants) => {
  let tNotResoindingList =[];
  for (const item of data_participants) {
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tNotResponding") {
          let data = {};
          data.emitDate = obj.emitDate;
          data.userId = item.userId;
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


function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
module.exports = {
  ManualGenAbandon,
  checkManualGenAbandon
};
