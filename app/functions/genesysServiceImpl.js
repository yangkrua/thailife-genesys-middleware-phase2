const log = require("./logger.js").LOG;

const platformClient = require("purecloud-platform-client-v2");

const Genesys = require("../config/genesys_server.js");
const client = platformClient.ApiClient.instance;
const CLIENT_ID = Genesys.GENESES.client_id;
const CLIENT_SECRET = Genesys.GENESES.client_secret;
client.setEnvironment(Genesys.GENESES.org_region);

class GenesysServiceImpl {

    async loginGenesys() {

        await log.info("Start Process login Genesys :" + await new Date());

        await client.loginClientCredentialsGrant(CLIENT_ID, CLIENT_SECRET)
            .then(async (data) => {

                client.setAccessToken(data.accessToken);
            })
            .catch(async (error) => {
                log.error(`API->loginClientCredentialsGrant(), error: ${error.message}`);
            });

        await log.info("End Process login Genesys :" + await new Date());

    }

    async getConversationsDetails(body) {

        let pageTotal = 2;
        let dataResult;
        let conversationObj;

        let apiInstance = new platformClient.ConversationsApi();

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

        }

        return conversationObj

    }

    async getListUsers() {

        const userGenesysList = [];

        let apiInstance = new platformClient.UsersApi();

        let body = {
            "pageSize": 100, // Number | Page size
            "pageNumber": 1 // Number | Page number
        };


        let pageTotal = 2;
        let dataResult;
        let objList;
        dataResult = await apiInstance.getUsers(body);

        if (
            (await dataResult) !== undefined &&
            (await dataResult.total) > 0
        ) {
            objList = await dataResult;
            pageTotal = Math.ceil(dataResult.total / 100);

            for (let i = 1; i < pageTotal; i++) {
                body.pageNumber = i + 1;
                dataResult = await apiInstance.getUsers(body);
                await Array.prototype.push.apply(
                    objList.entities,
                    dataResult.entities
                );
            } //end for
        }

        for (let i = 0; i < objList.entities.length; i++) {

            let userGenesys = {};
            userGenesys.id = objList.entities[i].id;
            userGenesys.name = objList.entities[i].name;
            userGenesys.divisionId = objList.entities[i].division.id;
            userGenesys.divisionName = objList.entities[i].division.name;
            userGenesys.email = objList.entities[i].email;
            userGenesys.userName = objList.entities[i].username;
            userGenesys.department = objList.entities[i].department === undefined ? "" : objList.entities[i].department;
            userGenesys.title = objList.entities[i].title === undefined ? "" : objList.entities[i].title;

            await userGenesysList.push(userGenesys);

        }

        return userGenesysList; Genesys
    };

    async getAnswersEvaluationFormGenesys(conversationId, evaluationId) {

        let apiInstance = new platformClient.QualityApi();

        let answersEvaluation;
        // Get an evaluation form
        await apiInstance.getQualityConversationEvaluation(conversationId, evaluationId, null)
            .then((data) => {
                answersEvaluation = data;
                log.info(`getQualityFormsEvaluation success! data: ${JSON.stringify(data, null, 2)}`);
            })
            .catch((err) => {
                log.error(`There was a failure calling getQualityFormsEvaluation , conversationId = ${conversationId} , evaluationId =  ${evaluationId} `);
                
            });

        return answersEvaluation;

    }

    async getListFormDetailGenesys(formId) {

        let apiInstance = new platformClient.QualityApi();

        let questionGroups;

        // Get an evaluation form
        await apiInstance.getQualityFormsEvaluation(formId)
            .then((data) => {
                questionGroups = data.questionGroups;
                log.info(`getQualityFormsEvaluation success! data: ${JSON.stringify(data, null, 2)}`);
            })
            .catch((err) => {
                log.error(`There was a failure calling getQualityFormsEvaluation , ${err}`);
                
            });

        return questionGroups;

    }


    async getListEvaluationFormGenesys() {

        const EvaluationFormGenesysList = [];

        let apiInstance = new platformClient.QualityApi();

        let body = {
            "expand": "publishHistory",
            "pageSize": 100, // Number | Page size
            "pageNumber": 1 // Number | Page number
        };


        let pageTotal = 2;
        let dataResult;
        let objList;
        dataResult = await apiInstance.getQualityFormsEvaluations(body);

        if (
            (await dataResult) !== undefined &&
            (await dataResult.total) > 0
        ) {
            objList = await dataResult;
            pageTotal = Math.ceil(dataResult.total / 100);

            for (let i = 1; i < pageTotal; i++) {
                body.pageNumber = i + 1;
                dataResult = await apiInstance.getQualityFormsEvaluations(body);
                await Array.prototype.push.apply(
                    objList.entities,
                    dataResult.entities
                );
            } //end for
        }

        for (let i = 0; i < objList.entities.length; i++) {
            const evaluationForm = objList.entities[i];

            let evaluationFormDetail = {};

            evaluationFormDetail.id = evaluationForm.id;
            evaluationFormDetail.name = evaluationForm.name;
            evaluationFormDetail.contextId = evaluationForm.contextId;
            evaluationFormDetail.modifiedDate = evaluationForm.modifiedDate;

            await EvaluationFormGenesysList.push(evaluationFormDetail);

            if (typeof evaluationForm.publishedVersions !== 'undefined'
                && typeof evaluationForm.publishedVersions.entities !== 'undefined'
                && evaluationForm.publishedVersions.entities.length > 0) {

                const publishedVersions = evaluationForm.publishedVersions.entities;
                for (let j = 0; j < publishedVersions.length; j++) {

                    const publishedVersionsDetail = publishedVersions[j];
                    let evaluationFormDetail = {};

                    evaluationFormDetail.id = publishedVersionsDetail.id;
                    evaluationFormDetail.name = publishedVersionsDetail.name;
                    evaluationFormDetail.contextId = publishedVersionsDetail.contextId;
                    evaluationFormDetail.modifiedDate = publishedVersionsDetail.modifiedDate;

                    await EvaluationFormGenesysList.push(evaluationFormDetail);
                }


            }


        }

        return EvaluationFormGenesysList;
    };

    async getPublishedFormsEvaluations() {

        const publishedFormList = [];

        let apiInstance = new platformClient.QualityApi();

        let body = {
            "pageSize": 100, // Number | Page size
            "pageNumber": 1 // Number | Page number
        };


        let pageTotal = 2;
        let dataResult;
        let objList;
        dataResult = await apiInstance.getQualityPublishedformsEvaluations(body);

        if (
            (await dataResult) !== undefined &&
            (await dataResult.total) > 0
        ) {
            objList = await dataResult;
            pageTotal = Math.ceil(dataResult.total / 100);

            for (let i = 1; i < pageTotal; i++) {
                body.pageNumber = i + 1;
                dataResult = await apiInstance.getQualityPublishedformsEvaluations(body);
                await Array.prototype.push.apply(
                    objList.entities,
                    dataResult.entities
                );
            } //end for
        }

        for (let i = 0; i < objList.entities.length; i++) {

            const objData = objList.entities[i];

            let publishedForm = {};

            publishedForm.id = objData.id;
            publishedForm.name = objData.name;
            publishedForm.contextId = objData.contextId;
            publishedForm.modifiedDate = objData.modifiedDate;

            await publishedFormList.push(publishedForm);

        }

        return publishedFormList;
    };
}

module.exports = GenesysServiceImpl;