const qmConfig = require("../config/qualityManagementConfig.js");


const fs = require('fs');

//const log = require("./logger.js").LOG;
const xlog = require('./xlog.js')
const log = new xlog('./logs/get_quality_evaluation', 'get_quality_evaluation.log');
log.init();


const moment = require('moment-timezone');


const genesysServiceImpl = require('./genesysServiceImpl.js');

const genesysService = new genesysServiceImpl();

let manualDateStart = null;
let manualDateEnd = null;

let manualGetEvaluationInfomation = async (pDateStart, pDateEnd) => {
  manualDateStart = pDateStart;
  manualDateEnd = pDateEnd;
  await getEvaluationInfomation();
}

let getEvaluationInfomation = async () => {


  await log.info("Start Process getEvaluationInfomation :" + await new Date());

  await genesysService.loginGenesys();

  await log.info(`Start Process getListUsers : ${await new Date()} `);
  const userGenesysList = await genesysService.getListUsers();

  await log.info(`Start Process getPublishedFormsEvaluations : ${await new Date()} `);
  const publishedFormsEvaluations = await genesysService.getPublishedFormsEvaluations();

  await log.info(`Start Process getListEvaluationFormGenesys : ${await new Date()} `);
  const formEvaluationGenesysList = await genesysService.getListEvaluationFormGenesys();

  await log.info(`Start Process filterDuplicateFormEvaluation : ${await new Date()} `);
  const allFormEvaluationGenesysList = await filterDuplicateFormEvaluation(publishedFormsEvaluations, formEvaluationGenesysList);

  await log.info(`Start Process initFormQuestionDetail : ${await new Date()} `);
  const evaluationFormDetailGenesysList = await initFormQuestionDetail(allFormEvaluationGenesysList);

  await log.info(`Start Process getConversationEvaluationDetail : ${await new Date()} `);
  const conversationEvaluationDetail = await getConversationEvaluationDetail();

  await log.info(`Start Process analyzeEvaluationDetail : ${await new Date()} `);
  const evaluationDetailList = await analyzeEvaluationDetail(conversationEvaluationDetail);

  const userAnswersDataList = [];

  await log.info("Start Loop analyzeEvaluationDetail :" + await new Date());
  let maxQuestionAndAnswers = 0;
  for (let i = 0; i < evaluationDetailList.length; i++) {
    const evaluationDetail = await evaluationDetailList[i];
    let conversationId = await evaluationDetail.conversationId;
    let conversationStart = await evaluationDetail.conversationStart;
    let evaluationId = await evaluationDetail.evaluationId;
    let evaluationStatus = await evaluationDetail.evaluationStatus;
    let evaluatorId = await evaluationDetail.evaluatorId;
    let assigneeId = await evaluationDetail.assigneeId;
    let eventTime = await evaluationDetail.eventTime;
    if (evaluationStatus != 'Pending') {
      let answersEvaluation = await genesysService.getAnswersEvaluationFormGenesys(conversationId, evaluationId);

      if (typeof answersEvaluation !== 'undefined') {

        let changedDate = await answersEvaluation.changedDate;
        let assignedDate = await answersEvaluation.assignedDate;
        let agentId = await answersEvaluation.agent.id;
        let userEvaluation = await userGenesysList.filter(obj => obj.id === agentId);
        let evaluatorName = "";
        let assigneeName = "";

        if (userGenesysList.filter(obj => obj.id === evaluatorId).length > 0) {
          evaluatorName = await userGenesysList.filter(obj => obj.id === evaluatorId)[0].name;
        }

        if (userGenesysList.filter(obj => obj.id === assigneeId).length > 0) {
          assigneeName = await userGenesysList.filter(obj => obj.id === assigneeId)[0].name;
        }

        if (typeof userEvaluation !== 'undefined' && userEvaluation.length > 0) {


          let divisionName = await userEvaluation[0].divisionName;
          let name = await userEvaluation[0].name;
          let userName = await userEvaluation[0].userName;
          let department = await userEvaluation[0].department;
          let title = await userEvaluation[0].title;

          let formName = await evaluationFormDetailGenesysList.filter(obj => obj.id === answersEvaluation.evaluationForm.id)[0].name;
          let formContextId = await evaluationFormDetailGenesysList.filter(obj => obj.id === answersEvaluation.evaluationForm.id)[0].contextId;
          let formId = await evaluationFormDetailGenesysList.filter(obj => obj.id === answersEvaluation.evaluationForm.id)[0].id;
          let formModifiedDate = await evaluationFormDetailGenesysList.filter(obj => obj.id === answersEvaluation.evaluationForm.id)[0].modifiedDate;

          let comments = '';
          let agentComments = '';

          if (typeof answersEvaluation.answers !== 'undefined'
            && typeof answersEvaluation.answers.comments !== 'undefined') {

            comments = await answersEvaluation.answers.comments;
          }
          if (typeof answersEvaluation.answers !== 'undefined'
            && typeof answersEvaluation.answers.agentComments !== 'undefined') {

            agentComments = await answersEvaluation.answers.agentComments;
          }

          const questionAndAnswersList = await filterQuestionScores(answersEvaluation, evaluationFormDetailGenesysList)

          if (maxQuestionAndAnswers < questionAndAnswersList.length) {
            maxQuestionAndAnswers = await questionAndAnswersList.length;
          }

          let dataFinal = {};

          dataFinal.conversationId = await conversationId;
          dataFinal.conversationStart = await conversationStart;
          dataFinal.userName = await userName;
          dataFinal.name = await name;
          dataFinal.department = await department;
          dataFinal.title = await title;
          dataFinal.comments = await comments;
          dataFinal.agentComments = await agentComments;
          dataFinal.divisionName = await divisionName;
          dataFinal.evaluationId = await evaluationId;
          dataFinal.evaluationStatus = await evaluationStatus;
          dataFinal.evaluatorName = await evaluatorName;
          dataFinal.assigneeName = await assigneeName;
          dataFinal.formContextId = await formContextId;
          dataFinal.formId = await formId;
          dataFinal.formName = await formName;
          dataFinal.formModifiedDate = await formModifiedDate;
          dataFinal.questionAndAnswersList = await questionAndAnswersList;
          dataFinal.changedDate = await changedDate;
          dataFinal.assignedDate = await assignedDate;
          userAnswersDataList.push(dataFinal);

          log.info("conversationId : " + conversationId);
          log.info("evaluationId : " + evaluationId);
          log.info("------------------------ ");
        }

        await log.info("End ");
      }

    }

  }

  await generateCSVFile(userAnswersDataList, maxQuestionAndAnswers);
  await log.info("End Loop");

}

let convertDateFormattToDDMMYYYY = async (isoDate) => {

  const formattedDate = new Date(isoDate).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return formattedDate;

}

let convertDateFormatToDDMMYYYYHHMMSS = async (isoDate) => {
  const date = new Date(isoDate);

  const formattedDate = date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const formattedTime = date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return `${formattedDate} ${formattedTime}`;
}

let generateCSVFile = async (userAnswersDataList, maxQuestionAndAnswers) => {

  let csvContent = '\uFEFF'; // Adding BOM to the beginning
  csvContent += 'Date,Conversation Id,Agent ID,Agent Name,BU,Department,Title,Form Context ID,Form ID,Form Name,Assigned Date,Changed Date,Evaluation Status,Evaluator Name,Assignee Name,Evaluator Comments,Agent Review Comments'; // Headers

  for (let i = 1; i <= maxQuestionAndAnswers; i++) {
    csvContent += `,Question ${i} (Score)`
  }
  csvContent += '\n';


  for (let i = 0; i < userAnswersDataList.length; i++) {

    let detail = userAnswersDataList[i];


    let conversationStart = await convertDateFormattToDDMMYYYY(detail.conversationStart);
    let conversationId = await detail.conversationId;
    let userName = await detail.userName;
    let name = await detail.name;
    let department = await detail.department;
    let title = await detail.title;
    let divisionName = await detail.divisionName;
    let evaluationId = await detail.evaluationId;
    let evaluationStatus = await detail.evaluationStatus;
    let evaluatorName = await detail.evaluatorName;
    let assigneeName = await detail.assigneeName;
    let formContextId = await detail.formContextId;
    let formId = await detail.formId;
    let formName = await detail.formName;
    let formModifiedDate = await convertDateFormattToDDMMYYYY(detail.formModifiedDate);
    let comments = await detail.comments.replace(/\n/g, " ");
    let agentComments = await detail.agentComments.replace(/\n/g, " ");
    let changedDate = await convertDateFormatToDDMMYYYYHHMMSS(detail.changedDate);
    let assignedDate = await convertDateFormatToDDMMYYYYHHMMSS(detail.assignedDate);

    csvContent += await `${conversationStart},${conversationId},${userName},${name},${divisionName},${department},${title},${formContextId},${formId},${formName},${assignedDate},${changedDate},${evaluationStatus},${evaluatorName},${assigneeName},${comments},${agentComments}`;

    let questionAndAnswersList = await detail.questionAndAnswersList;

    for (let j = 0; j < questionAndAnswersList.length; j++) {
      let questionAndAnswers = await questionAndAnswersList[j];
      let score = await questionAndAnswers.score;
      csvContent += await `,${score}`
    }

    csvContent += '\n';
  }

  const now = new Date();

  // ฟังก์ชันเพื่อเติมเลข 0 ข้างหน้า (ถ้าจำเป็น)
  const padZero = (num, size) => String(num).padStart(size, '0');

  // สร้างฟอร์แมตตามที่ต้องการ  // Output: 20240914_104257828
  const formattedDateTime = await
    now.getFullYear() +
    padZero(now.getMonth() + 1, 2) +
    padZero(now.getDate(), 2) + '_' +
    padZero(now.getHours(), 2) +
    padZero(now.getMinutes(), 2) +
    padZero(now.getSeconds(), 2) +
    padZero(now.getMilliseconds(), 3);

  let pathFile = await qmConfig.data_process_inbox;
  let fileName = await `${pathFile}/QualityEvaluation_${formattedDateTime}.csv`;

  // Write the CSV string to a file
  fs.writeFile(fileName, csvContent, { encoding: 'utf8' }, (err) => {
    if (err) {
      log.error(`Error writing to file, ${err}`);
    } else {
      log.info('CSV file has been written successfully.');
    }
  });

}

let filterQuestionScores = async (answersEvaluation, evaluationFormDetailGenesysList) => {
  let answerList = answersEvaluation.answers;
  let questionGroupScoreList = answerList.questionGroupScores;

  const questionScoreDetailList = [];
  for (let i = 0; i < questionGroupScoreList.length; i++) {
    const questionGroupScore = await questionGroupScoreList[i];

    const questionGroupId = await questionGroupScore.questionGroupId;
    const questionScoreList = await questionGroupScore.questionScores;

    let questionGroupName = await evaluationFormDetailGenesysList
      .flatMap(obj => obj.questionGroupsList) // Flatten categories arrays
      .find(questionGroup => questionGroup.id === questionGroupId).name

    for (let j = 0; j < questionScoreList.length; j++) {
      let questionScoreDetail = await questionScoreList[j];

      const questionId = await questionScoreDetail.questionId;

      const questionName = await evaluationFormDetailGenesysList
        .flatMap(obj => obj.questionGroupsList) // Flatten categories arrays
        .flatMap(questionGroup => questionGroup.questions) // Flatten items arrays
        .find(question => question.id === questionId).text;

      questionScoreDetail.questionGroupId = await questionGroupId;
      questionScoreDetail.questionGroupName = await questionGroupName;
      questionScoreDetail.questionName = await questionName;

      questionScoreDetailList.push(questionScoreDetail);
    }
  }

  return questionScoreDetailList;

}

let filterDuplicateFormEvaluation = async (publishedFormsEvaluations, formEvaluationGenesysList) => {

  let allFormEvaluationGenesysList = publishedFormsEvaluations;

  for (let i = 0; i < formEvaluationGenesysList.length; i++) {

    const data = await formEvaluationGenesysList[i];

    const exists = await allFormEvaluationGenesysList.some(obj => obj.id === data.id);

    if (!exists) {
      publishedFormsEvaluations.push(data);
    }


  }

  return publishedFormsEvaluations;

}
let analyzeEvaluationDetail = async (conversationEvaluationDetail) => {

  let evaluationDetailGenesys = await conversationEvaluationDetail.conversations;

  const evaluationDetailList = [];

  for (let i = 0; i < evaluationDetailGenesys.length; i++) {

    let data = await evaluationDetailGenesys[i];
    let evaluationList = await data.evaluations;

    for (let j = 0; j < evaluationList.length; j++) {
      evaluationList[j].conversationId = await data.conversationId;
      evaluationList[j].conversationStart = await data.conversationStart;

      evaluationDetailList.push(evaluationList[j]);
    }

  }

  return evaluationDetailList;

}

let getConversationEvaluationDetail = async () => {

  var pDateStart = moment().add(- qmConfig.data_query_period_month, "months").startOf('day');
  var pDateStop = moment();

  if (manualDateStart != null) {
    pDateStart = moment(manualDateStart + "T00:00:00.000");
  }

  if (manualDateEnd != null) {
    pDateStop = moment(manualDateEnd + "T23:59:59.000");
  }

  let body = {

    interval: pDateStart.format("YYYY-MM-DDTHH:mm:ss.SSSZ") + "/" + pDateStop.format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
    evaluationFilters: [
      {
        predicates: [
          {
            type: "dimension",
            dimension: "evaluationId",
            operator: "exists",
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

  return await genesysService.getConversationsDetails(body);

}

let initFormQuestionDetail = async (evaluationFormGenesysList) => {

  for (let i = 0; i < evaluationFormGenesysList.length; i++) {
    let formId = await evaluationFormGenesysList[i].id;
    evaluationFormGenesysList[i].questionGroupsList = await genesysService.getListFormDetailGenesys(formId);
  }

  return evaluationFormGenesysList;
}



module.exports = {
  getEvaluationInfomation,
  manualGetEvaluationInfomation,
};
