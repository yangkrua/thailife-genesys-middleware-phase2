const log = require("./logger.js").LOG;

const express = require('express')
const axios = require('axios');
const app = express()
const PORT = process.env.PORT || 3010
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https')
const agent = new https.Agent({
    rejectUnauthorized: false,
})

const configSalesForce_DEV = require("../config/sales_force_server_DEV.js");
const configSalesForce_SIT = require("../config/sales_force_server_SIT.js");
const configSalesForce_UAT = require("../config/sales_force_server_UAT.js");
const configSalesForce_PROD = require("../config/sales_force_server_PROD.js");

let getAccessTokenSalesforce = async (urlGetToken) => {
    try {

        const response = await axios.post(urlGetToken, null, {
            params: {
                grant_type: configSalesForce_DEV.SALES_FORCE.GRANT_TYPE,
                client_id: configSalesForce_DEV.SALES_FORCE.CLIENT_ID,
                client_secret: configSalesForce_DEV.SALES_FORCE.CLIENT_SECRET,
                username: configSalesForce_DEV.SALES_FORCE.USERNAME,
                password: configSalesForce_DEV.SALES_FORCE.PASSWORD
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response ? error.response.data : error.message);
        throw error;
    }
  }

  let getAccessTokenSalesforceTLF = async (urlGetToken) => {
    
    return new Promise((resolve, reject) => {
      try {
          axios({
              method: "get",
              url: urlGetToken,
          }).then(async (response) => {
              console.log(response.data);
              resolve(JSON.stringify(response.data.responseRecord.accessToken))
          }).catch(async (error) => {
              console.log(error);
              resolve(error)
          })
      } catch (err) {
          reject(err)
      }
  })
  }


  let callApiSaveAbandonCallSalesforce = async (dataList,env) => {
    await log.info("Start Process callApiSaveAbandonCallSalesforce :"+await new Date() );
    try {
      
        let urlSF ='';
        let service = '';

        let fullURL ='';
        let urlGetToken = '';
        let token = '';

        if(env == 'DEV'){
          urlSF = configSalesForce_DEV.SALES_FORCE.URL;
          service = configSalesForce_DEV.SALES_FORCE.SERVICE_SAVE_ABANDON_CALL;
          
          urlGetToken = configSalesForce_DEV.SALES_FORCE.URL_GET_TOKEN;
          token = await getAccessTokenSalesforceTLF(urlGetToken);

        }else if(env == 'SIT'){
          urlSF = configSalesForce_SIT.SALES_FORCE.URL;
          service = configSalesForce_SIT.SALES_FORCE.SERVICE_SAVE_ABANDON_CALL;

          urlGetToken = configSalesForce_SIT.SALES_FORCE.URL_GET_TOKEN;
          token = await getAccessTokenSalesforceTLF(urlGetToken);

        }else if(env == 'UAT'){
          urlSF = configSalesForce_UAT.SALES_FORCE.URL;
          service = configSalesForce_UAT.SALES_FORCE.SERVICE_SAVE_ABANDON_CALL;

          urlGetToken = configSalesForce_UAT.SALES_FORCE.URL_GET_TOKEN;
          token = await getAccessTokenSalesforceTLF(urlGetToken);

        }else if(env == 'PROD'){
          urlSF = configSalesForce_PROD.SALES_FORCE.URL;
          service = configSalesForce_PROD.SALES_FORCE.SERVICE_SAVE_ABANDON_CALL;

          urlGetToken = configSalesForce_PROD.SALES_FORCE.URL_GET_TOKEN;
          token = await getAccessTokenSalesforceTLF(urlGetToken);
        }

        fullURL = urlSF+service;

        token = token.replace(/"/g, '');
        console.log('token :', token);
        
        for(let i = 0 ; i < dataList.length ;i++){

          const dataAbandonList = [];
          dataAbandonList.push(dataList[i]);
          console.log( (i+1) +' Conversation_Id :' + dataList[i].Conversation_Id );
          await log.info( (i+1) +' Conversation_Id :' + dataList[i].Conversation_Id );
          try {
            const response = await axios.post(fullURL, {
                dataList: dataAbandonList // Set the array list to dataList
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            await log.info('saveAbandonCall response statusCode: ' + response.data.statusCode);
            console.log('saveAbandonCall response statusCode:', response.data.statusCode);
            console.log('saveAbandonCall response statusMessage:', response.data.statusMessage);
            console.log('saveAbandonCall response message:', response.data.message);
          } catch (error) {

              console.log('Request payload:', {
              dataList: dataAbandonList // Log the request data
            });

            if (error.response) {
              // The request was made, and the server responded with a status code
              // that falls out of the range of 2xx

              console.log('saveAbandonCall Error data:', error.response.data);
              console.log('saveAbandonCall Error status:', error.response.status);
              console.log('saveAbandonCall Error headers:', error.response.headers);

              await log.error('saveAbandonCall Error data: ' +  JSON.stringify(error.response.data));
              await log.error('saveAbandonCall Error status: ' +  error.response.status);
              await log.error('saveAbandonCall Error headers: '+  error.response.headers);
            } else if (error.request) {
              // The request was made, but no response was received
              console.log('saveAbandonCall Error request:', error.request);
              await log.error('saveAbandonCall Error request: ' + error.request);
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log('saveAbandonCall Error message:', error.message);
              await log.error('saveAbandonCall Error message: ' + error.message);
            }
            await log.error('saveAbandonCall Error config: ' + error.config);
            console.log('saveAbandonCall Error config:', error.config);
          }

          await delay(2000);

        }

    } catch (error) {
        console.error('Error calling AbandonCall API:', error.response ? error.response.data : error.message);
        let response = error.response ? error.response.data : error.message;
        await log.info('Error calling AbandonCall API: ' + response);
        throw error;
    }

    await log.info("End Process callApiSaveAbandonCallSalesforce :"+await new Date() );
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  module.exports = {
    callApiSaveAbandonCallSalesforce
  };
  