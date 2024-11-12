const Client = require("ssh2-sftp-client");
const sftp = new Client();
const log = require("./logger.js").LOG;
const fs = require("node:fs");

const path = require("path");
const moment = require("moment");
const dbConfig = require('./survey_dbservice.js');
const config = require("../config/survey_server.js");
const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();

const client = platformClient.ApiClient.instance;
const CLIENT_ID = config.GENESES.client_id;
const CLIENT_SECRET = config.GENESES.client_secret;
client.setEnvironment(config.GENESES.org_region);

let pDate = null;


let ManualGetSurveyFlowAndInsertData = async (pDateIn) => {
    pDate = pDateIn;
    getSurveyFlowAndInsertData();
};

let getSurveyFlowAndInsertData = async () => {

  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {
      log.info("Start Process getSurveyFlowAndInsertData :"+await new Date() );
      
      let dataSurveyExceptQueueList = [];
      let dataSurveyDivisionList = [];
      
      let dataTableSurveyExceptQueueObj = await getDataTableByName(config.GENESES.SURVEY_EXCEPT_QUEUE_DATA_TABLE.NAME);
      if(await dataTableSurveyExceptQueueObj.total > 0){
        let dataTableId = await dataTableSurveyExceptQueueObj.entities[0].id;
        
        let rowDataObj = await getRowDataInDataTableByID(dataTableId);
        let dataSurveyExceptQueueObj = await getInfomationSurveyExceptQueue(rowDataObj);

        await Array.prototype.push.apply(
          dataSurveyExceptQueueList,
          dataSurveyExceptQueueObj
        );
      }

      let dataTableSurveyDivisionObj = await getDataTableByName(config.GENESES.SURVEY_DIVISION_DATA_TABLE.NAME);
      if(await dataTableSurveyDivisionObj.total > 0){
        let dataTableId = await dataTableSurveyDivisionObj.entities[0].id;
        
        let rowDataObj = await getRowDataInDataTableByID(dataTableId);
        let dataSurveyDivisionObj = await getInfomationSurveyDivision(rowDataObj);

        await Array.prototype.push.apply(
          dataSurveyDivisionList,
          dataSurveyDivisionObj
        );
      }

      await analyticsConversationsDetailsSurvey(dataSurveyDivisionList,dataSurveyExceptQueueList);

      log.info("End Process getSurveyFlowAndInsertData :"+await new Date() );
    })
    .catch(async (error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });

};


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
        //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
        if (
          (await dataResult) !== undefined &&
          (await dataResult.total) > 0
        ) {
          rowDataObj = await dataResult;
          pageTotal = await Math.ceil(dataResult.total / 100);
  
          for (let i = 1; i < pageTotal; i++) {
            opts.pageNumber = i+1;
            dataResult = await getFlowsDatatableRows(datatableId, opts)
            await Array.prototype.push.apply(
              rowDataObj.entities,
              dataResult.entities
            );
          } //end for

          
        }
      })
      .catch(async (err) => {
        console.log("There was a failure calling getFlowsDatatableRows");
        console.error(err);
      });
  
    return  rowDataObj;
  
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
      }
    );
  
    return  dataTableObj;
  };

  let getInfomationSurveyDivision = async(rowDataObj) =>{
    let dataSurveyDivisionObj = [];
    for(let i = 0 ; i < rowDataObj.total ; i++){
             
      if (
        (await rowDataObj.entities[i].key ) !== undefined &&
        (await rowDataObj.entities[i].DIVISION_ENABLE) !== undefined &&
        (await rowDataObj.entities[i].DIVISION_ENABLE) == true &&
        (await rowDataObj.entities[i].key ) !== ''
      )
      {
        var divisionId = await rowDataObj.entities[i].key ;
        dataSurveyDivisionObj.push(divisionId);
      }
    }
    return  dataSurveyDivisionObj;

  }
  
  let getInfomationSurveyExceptQueue = async(rowDataObj) =>{
    let dataSurveyExceptQueueObj = [];
    for(let i = 0 ; i < rowDataObj.total ; i++){
             
      if (
        (await rowDataObj.entities[i].QUEUE_NAME) !== undefined &&
        (await rowDataObj.entities[i].QUEUE_ENABLE) !== undefined &&
        (await rowDataObj.entities[i].QUEUE_ENABLE) == true &&
        (await rowDataObj.entities[i].QUEUE_NAME) !== ''
      )
      {
        var queueName = await rowDataObj.entities[i].QUEUE_NAME;
        dataSurveyExceptQueueObj.push(queueName);
      }
    }
    return  dataSurveyExceptQueueObj;

  }


  let analyticsConversationsDetailsSurvey = async(dataSurveyDivisionList,dataSurveyExceptQueueList) => {
    //log.info("analyticsConversationsDetailsSurvey->login(), success fully!");
    const dataSurveyList = [];
    let countInsertUpdate =1;
    //pro
    var pDateStart = moment().add(-config.GENESES.data_query_period, "minute");
    var pDateStop = moment();
   
    if(pDate != null){
       pDateStart = moment(pDate + "T00:00:00.000");
       pDateStop = moment(pDate + "T23:59:59.000");
    }

    let pageTotal = 2;
    let dataResult;
    let conversationObj;

    let body = {
    //   interval: pDateStart + "/" + pDateStop,
      interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
      segmentFilters: [
        {
          predicates: [
            {
              dimension: "direction",
              value: "inbound"
            },
            {
              dimension: "direction",
              value: "outbound"
            }
          ],
          type: "or",
        },
      ],
      paging: {
        pageSize: 100,
        pageNumber: 1,
      },
      order: "asc",
    };

    //log.info( `API->postAnalyticsConversationsDetailsQuery(), Body= ${JSON.stringify(body )}` );

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
        //log.info( `API->postAnalyticsConversationsDetailsQuery(), PageNo=${body.paging.pageNumber}, Result: ${JSON.stringify(dataResult)}` );
        await Array.prototype.push.apply(
          conversationObj.conversations,
          dataResult.conversations
        );
      } //end for
      if (
        (await conversationObj.conversations) !== undefined &&
        (await conversationObj.conversations.length) > 0
      ) {

        for(let i =0 ; i < conversationObj.conversations.length ; i++){
          let conversationItem = await conversationObj.conversations[i];
          let conversationId = await conversationItem.conversationId;
          let continueFlag = await false;

          if (await !istAbandon(conversationItem.participants)) {
            continue;
          }

          continueFlag = true;
          //loop Check Division Pass
          for(let index=0 ; index < conversationItem.divisionIds.length; index++){
            let divisionId = await conversationItem.divisionIds[index];
            const exists = await dataSurveyDivisionList.includes(divisionId);
            if(exists){
              continueFlag = false;
              break;
            }
          }
          //End loop Check Division
          if(continueFlag){
            continue;
          }


          //loop check Survey Except Queue List
          for(let j = 0 ;j<conversationItem.participants.length ; j++){
            let participantName = await conversationItem.participants[j].participantName;
            const exists = await dataSurveyExceptQueueList.includes(participantName);
            if(exists){
              continueFlag = true;
              break;
            }
          }
          //end loop check Survey Except Queue List
          if(continueFlag){
            continue;
          }

          
          await apiInstance.getConversationsCall(conversationId)//('e40c2393-0932-456c-b763-37ff90118aff')      //(conversationId)
          .then(async (data) => {

            let customerphoneNumber = null;
            let surveyScore = null ;
            let startTimeSurvey = null;
            let updateTimeSurvey = null;
            let policyNumber = null;
            let conversationStartTime = null;
            if (
              (await data) !== undefined &&
              (await data.participants)  !== undefined &&
              (await data.participants.length) > 0
            ) {

              data.participants.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

              if((await data.participants[0].startTime)  !== undefined ){
                conversationStartTime = await convertDateTime(data.participants[0].startTime);
                conversationStartTime = await convertTimeZoneBangkok(conversationStartTime);
              }

              for(let index_p = 0 ;index_p < data.participants.length ; index_p++){
                let participant = await data.participants[index_p];
                
                if( (await participant.name) !== undefined && participant.name.includes("Mobile Number")){
                  if(participant.direction == 'inbound'){
                    if( participant.ani.includes("tel:+66")){
                      customerphoneNumber = participant.ani.replace("tel:+66", "0");
                    }else{

                    }

                    
                  }else if(participant.direction == 'outbound'){
                    customerphoneNumber = participant.dnis.replace("tel:+66", "0");
                  }
                }


                if (
                  (await participant) !== undefined &&
                  (await participant.attributes)  !== undefined 
                ) {

                  let attributes = await participant.attributes;

                  if((await attributes.SURVEY_SCORE_01)  !== undefined ){
                    surveyScore = attributes.SURVEY_SCORE_01;
                    
                  }

                  if((await attributes.SURVEY_START_TIME)  !== undefined ){
                    startTimeSurvey = await convertDateTime(attributes.SURVEY_START_TIME)
                    
                  }

                  if((await attributes.SURVEY_UPDATE_TIME)  !== undefined ){
                    updateTimeSurvey = await convertDateTime(attributes.SURVEY_UPDATE_TIME);
                    
                  }

                  if((await attributes.SURVEY_ANI)  !== undefined ){
                    customerphoneNumber = attributes.SURVEY_ANI
                    
                  }

                  if((await attributes.POLICY_NUMBER)  !== undefined ){
                    policyNumber = attributes.POLICY_NUMBER;
                    
                    if((await attributes.IVR_POLICY_NO )  !== undefined ){
                      policyNumber = attributes.IVR_POLICY_NO ;
                      
                    } 
                    
                  } 

                  if((await attributes.ANI_NUMBER)  !== undefined ){
                    if(await attributes.ANI_NUMBER.startsWith("0")){
                      customerphoneNumber = await parserPhoneNumber(attributes.ANI_NUMBER);
                    }
                  }
                }

              }
            }
            
            dataSurveyList.push(conversationId);
            if(customerphoneNumber != null){

              if(surveyScore == null){
                startTimeSurvey = conversationStartTime;
              }
              else if(surveyScore =='0'){
                surveyScore = null;
                updateTimeSurvey = startTimeSurvey;
              }else if( parseInt(surveyScore) >5 ){
                surveyScore = null;
                updateTimeSurvey = startTimeSurvey;
              }

              const dataToInsertOrUpdate = {
                UCID: conversationId,
                CUSTOMER: customerphoneNumber,
                SCORE: surveyScore,
                START_TIME: startTimeSurvey,
                UPDATE_TIME: updateTimeSurvey,
                UUI: null,
                AGENT: null,
                ID: policyNumber,
                UCID2: conversationId
              };
              console.log("insertOrUpdateIVRSurvey : "+countInsertUpdate);
              countInsertUpdate = countInsertUpdate+1;
              await dbConfig.insertOrUpdateIVRSurvey(dataToInsertOrUpdate);
            }
            if(dataSurveyList.length >=100  &&  dataSurveyList.length% 100 == 0){
              console.log("Wait for 30 seconds Rate limit exceeded the maximum api Genesys");
              await delay(30000);
            }
          })
          .catch(async (err) => {
            console.log("There was a failure calling getConversationsCall");
            console.error(err);
          });
          
        }
      }
    }

  };

  let convertDateTime = (timestamp) => {

    if (
      ( timestamp) == undefined ||
      ( timestamp) == ''
    ){
      return null;
    }
    
    const date = new Date(timestamp);
    // Extract the date parts
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    // Extract the time parts
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');

    // Combine them into the desired format
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    return formattedDate;
  };

  let istAbandon = async (data_participants) => {
    for (const item of data_participants) {
      if ((await item.sessions[0].metrics) !== undefined) {
        for (const obj of item.sessions[0].metrics) {
          if ((await obj.name) === "tAbandon") {
            //await log.info(`====== tAbandon =======`);
            return true;
          }
        }
      }
    }
  
    return false;
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
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let convertTimeZoneBangkok = async (dateStr) => {
    // Extract the milliseconds part
      let originalMilliseconds = dateStr.split('.')[1];

      // Convert to Date object
      let date = new Date(dateStr + ' UTC');

      // Convert to Asia/Bangkok time zone
      let bangkokDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

      // Format the date
      let year = bangkokDate.getFullYear();
      let month = String(bangkokDate.getMonth() + 1).padStart(2, '0');
      let day = String(bangkokDate.getDate()).padStart(2, '0');
      let hours = String(bangkokDate.getHours()).padStart(2, '0');
      let minutes = String(bangkokDate.getMinutes()).padStart(2, '0');
      let seconds = String(bangkokDate.getSeconds()).padStart(2, '0');

      // Combine into the desired format, using the original milliseconds
      let formattedDateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${originalMilliseconds}`;

    return formattedDateStr;
  };

module.exports = { 
  getSurveyFlowAndInsertData
  ,ManualGetSurveyFlowAndInsertData
};
  