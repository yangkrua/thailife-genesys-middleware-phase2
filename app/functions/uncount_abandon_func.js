const config = require("../config/uncount_abandon_config.js");
const genesys = require("../config/genesys_server.js");

const log = require("./logger.js").LOG;
const moment = require('moment-timezone');
const platformClient = require("purecloud-platform-client-v2");
const apiInstance = new platformClient.ConversationsApi();

const fs = require('fs').promises;

const client = platformClient.ApiClient.instance;
const CLIENT_ID = genesys.GENESES.client_id;
const CLIENT_SECRET = genesys.GENESES.client_secret;
client.setEnvironment(genesys.GENESES.org_region);

let pDate;
let dataQueueIdObj;
let countCSVfile = 1;
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


let getInfomationQueueAbandon = async (dataTableObj) => {
  let dataQueueIdObj = {};

  for (let i = 0; i < dataTableObj.total; i++) {

    if (
      (await dataTableObj.entities[i].key) !== undefined &&
      (await dataTableObj.entities[i].key) != ''
    ) {
      var queueId = await dataTableObj.entities[i].key;
      var queueName = await dataTableObj.entities[i].QUEUE_NAME;
      var divisionName = await dataTableObj.entities[i].DIVISION_NAME; 

      if (!dataQueueIdObj[queueId]) {
        dataQueueIdObj[queueId] = {};
      }

      dataQueueIdObj[queueId].queueId = queueId;
      dataQueueIdObj[queueId].queueName = queueName;
      dataQueueIdObj[queueId].divisionName = divisionName;
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
      //console.log(`getFlowsDatatableRows success! data: ${JSON.stringify(dataResult, null, 2)}`);
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
      console.log("There was a failure calling getFlowsDatatableRows");
      console.error(err);
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
      console.log("There was a failure calling getFlowsDatatables");
      console.error(err);
    }
    );

  return dataTableObj;
};

let analyticsConversationsDetails = async () => {

  var pDateStart = moment().add(-config.GENESES.data_query_period, "minute");
  var pDateStop = moment();

  if(pDate != null){
    pDateStart = moment(pDate + "T00:00:00.000");
    pDateStop = moment(pDate + "T23:59:59.000");
  }

  console.log("pDateStart : "+ pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
  console.log("pDateStop : "+ pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
  console.log("postAnalyticsConversationsDetailsQuery Start...");
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

    //conversationObj;
    console.log("postAnalyticsConversationsDetailsQuery End...");
    await processUncountAbandon(conversationObj);
    
  }
};


let uncount_abandon_process = async (inputDate) => {

   pDate = await inputDate;

  await client
    .loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
    .then(async () => {

      console.log("loginClientCredentialsGrant : ");

      let listOfQueues = await getGetListOfQueues();
      let dataTableObj = await getDataTableByName(config.GENESES.DATA_TABLE.NAME);

      if (await dataTableObj.total > 0) {
        let dataTableId = await dataTableObj.entities[0].id;

        let rowDataObj = await getRowDataInDataTableByID(dataTableId);
        dataQueueIdObj = await getInfomationQueueAbandon(rowDataObj);

        for (const key in dataQueueIdObj) {
          if (dataQueueIdObj.hasOwnProperty(key)) {
            let name = "";
            if( (await listOfQueues.entities.find(element => element.id === key)) === undefined){
              
              console.log("Queue not Found key : " +key +" : "+ dataQueueIdObj[key].queueName);
            }else{
              name = listOfQueues.entities.find(element => element.id === key).name;
            }
            
            dataQueueIdObj[key].queueName = name;
          }
        }

        console.log("dataTableId : " + dataTableId);
        console.log(`dataQueueIdObj ! data: ${JSON.stringify(dataQueueIdObj, null, 2)}`);

        await analyticsConversationsDetails();

      }

    })
    .catch(async (error) => {
      log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
    });
    log.info("End Process gen Abandon Care Center :"+await new Date() );
};


let isTransactionAbandon = async (data_participants) => {

  let breakFlag = false;
  let dataQueueObjList = [];
  for (const item of data_participants) {
    breakFlag = false;
    if ((await item.sessions[0].metrics) !== undefined) {
      for (const obj of item.sessions[0].metrics) {
        if ((await obj.name) === "tAbandon") {
          for (const objSegments of item.sessions[0].segments) {
            if (await objSegments.queueId !== undefined) {
              if (await(objSegments.queueId in dataQueueIdObj)) {
                if(await dataQueueIdObj[objSegments.queueId]){
                  let dataQueueObj = {} ;
                  let queueId = objSegments.queueId;
                  dataQueueObj.participantId = await item.participantId;
                  dataQueueObj.queueId = await dataQueueIdObj[queueId].queueId;
                  dataQueueObj.queueName =  await dataQueueIdObj[queueId].queueName ;
                  dataQueueObj.divisionName = await dataQueueIdObj[queueId].divisionName ;
                  dataQueueObj.timeStart =  await new Date(objSegments.segmentStart)
                  dataQueueObj.timeEnd = await new Date(obj.emitDate)
                  dataQueueObjList.push(dataQueueObj);
                  breakFlag = true;
                  break;
                }
              }
            }
          }
          if(breakFlag) break;
        }
      }
    }
  }
  return dataQueueObjList;
};

let processUncountAbandon = async (conversationObj) => {

  console.log("processUncountAbandon Start...");
  let count = 1;
  let abanDivisionList = {};
  for (const item of conversationObj.conversations) {

    let conversationId = item.conversationId;
    let ani = item.participants[0].sessions[0].ani;
    let conversationStart = await new Date(item.conversationStart);

    let participantAbandonList = await isTransactionAbandon(item.participants);
    
    if (participantAbandonList.length > 0 ) {

      let purposeCustomer = item.participants.find(element => element.purpose  === 'customer');

      let conversationEnd = await new Date(purposeCustomer.sessions[0].metrics[1].emitDate);
      

      for(const abandonObj of participantAbandonList){

        let divisionName = abandonObj.divisionName;
        let timeEnd = abandonObj.timeEnd;
        let diffInMillisecond = await dateDiffInMilliseconds(timeEnd,conversationEnd)
        if (diffInMillisecond > 1000) {
          if (!abanDivisionList[divisionName]) {
            abanDivisionList[divisionName] = [];
          }
          abandonObj.conversationId = conversationId;
          abandonObj.ani = ani;
          abandonObj.conversationStart = conversationStart;
          abandonObj.conversationEnd = conversationEnd;
          abanDivisionList[divisionName].push(abandonObj);

          console.log( count + ": ["+divisionName+"] "+"istAbandon conversationId : " + conversationId);
          count = await count+1;
        }
      }
    }
  }


  let dataAbandonList = {};

  let divisionList = Object.keys(abanDivisionList);

  for(const divisionName of divisionList){
    for(const queueObj of abanDivisionList[divisionName]){
      
      let queueName = queueObj.queueName;
      try {

      if (!dataAbandonList[divisionName]) {
        dataAbandonList[divisionName] = [];
      }

      if (!dataAbandonList[divisionName][queueName]) {
        dataAbandonList[divisionName][queueName] = [];
      }

      dataAbandonList[divisionName][queueName].push(queueObj);
    }
    catch(err) {
      console.log( err);
    }
    }
  }
  console.log("processUncountAbandon End...");
  console.log("generateFileDetailUncountAbandon Start...");
  for(const divisionName of divisionList){

    let queueList = Object.keys(dataAbandonList[divisionName]);
    for(const queueName of queueList){
      dataAbandonList[divisionName][queueName];
      await generateFileDetailUncountAbandon(divisionName,queueName,dataAbandonList[divisionName][queueName]);
      countCSVfile = countCSVfile+1;
    }
    
  }
  console.log("generateFileDetailUncountAbandon End...");
};


function dateDiffInMilliseconds(date1, date2) {
  // Convert both dates to milliseconds
  const date1Ms = new Date(date1).getTime();
  const date2Ms = new Date(date2).getTime();

  // Calculate the difference in milliseconds
  return Math.abs(date2Ms - date1Ms) ;
}

async function formatDateToString(date) {
  const padToTwoDigits = (num) => (num < 10 ? '0' + num : num);
  
  const day = padToTwoDigits(date.getDate());
  const month = padToTwoDigits(date.getMonth() + 1); // Months are zero-indexed
  const year = date.getFullYear();
  
  const hours = padToTwoDigits(date.getHours());
  const minutes = padToTwoDigits(date.getMinutes());
  const seconds = padToTwoDigits(date.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}


let parserTelPhoneNumber = async (mobile) => {

  mobile = mobile.replace("+66", "0");

  if (mobile.startsWith("tel:")) {
    return mobile.replace("tel:", "");
  } else if (mobile.startsWith("sip:")) {
    return mobile.replace("sip:", "");
  }
  return mobile; // ถ้าไม่มีเงื่อนไขใดตรง จะคืนค่าตัวแปร a กลับไป
};

let generateFileDetailUncountAbandon = async (divisionName,queueName,abandonList) => {
  
  //console.log( divisionName);

  let csvContent = '\uFEFF'; // Adding BOM to the beginning

  let csvContentTemp = 'No.,Conversation Start,Conversation End,Date Queue Start,Date Queue End,Queue Name,Conversation ID,ANI\n'; // Headers
  let index ;
  for(let i=0 ; i < abandonList.length ; i++){
  
    let detail = abandonList[i];
    index = i+1;
    let conversationStart = await formatDateToString(detail.conversationStart);
    let dateQueueStart = await formatDateToString(detail.timeStart);
    let dateQueueEnd = await formatDateToString(detail.timeEnd);
    let conversationEnd = await formatDateToString(detail.conversationEnd);
    //let queueName = detail.queueName;
    let conversationId = detail.conversationId;
    //let ani =  `"${await parserTelPhoneNumber(detail.ani)}"` ;
    let ani = detail.ani;
    csvContentTemp += `${index},${conversationStart},${conversationEnd},${dateQueueStart},${dateQueueEnd},${queueName},${conversationId},${ani}`;
    
    csvContentTemp += '\n';
  }

  csvContent += 'Totol Record '+index+' Row,,,,,,,\n'
  csvContentTemp += '\n';
  csvContent += csvContentTemp;

  const formattedCsvContent = await formatCsvContent(csvContent);

  const now = new Date();

  // ฟังก์ชันเพื่อเติมเลข 0 ข้างหน้า (ถ้าจำเป็น)
  const padZero = (num, size) => String(num).padStart(size, '0');
  
  // สร้างฟอร์แมตตามที่ต้องการ  // Output: 20240914_104257828
  const formattedDateTime = 
    now.getFullYear() + 
    padZero(now.getMonth() + 1, 2) + 
    padZero(now.getDate(), 2) + '_' +
    padZero(now.getHours(), 2) + 
    padZero(now.getMinutes(), 2) + 
    padZero(now.getSeconds(), 2) + 
    padZero(now.getMilliseconds(), 3);
  
  let pathFile =  config.data_process_inbox ; 
  let fileName = `${pathFile}/${divisionName}_[${queueName}]_${formattedDateTime}.csv`;

  await  writeCsvToFile(fileName, formattedCsvContent);
  // Write the CSV string to a file
 


};

async function writeCsvToFile(fileName, formattedCsvContent) {
  try {
    await fs.writeFile(fileName, formattedCsvContent, { encoding: 'utf8' });
    console.log(countCSVfile +': CSV file has been written successfully: ' + fileName);
  } catch (err) {
    console.error('Error writing to file', err);
  }
}

async function formatCsvContent(csvContent) {
  return csvContent
      .split('\n') // แยกแต่ละบรรทัด
      .map(line => 
          line
              .split(',') // แยกคอลัมน์ด้วย comma
              .map(column => `"${column.trim()}"`) // ใส่ quote ครอบทุกคอลัมน์
              .join(',') // รวมกลับเป็นบรรทัดเดียว
      )
      .join('\n'); // รวมทุกบรรทัดกลับเข้าด้วยกัน
}
module.exports = {
  uncount_abandon_process
};
