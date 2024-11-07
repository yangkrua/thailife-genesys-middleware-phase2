const log            = require("./app/functions/logger.js").LOG;
const config         = require('./app/config/survey_server.js');
const survey_genesys = require('./app/functions/survey_genesys.js');
const morganBody     = require('morgan-body');
const fs             = require('fs');
const path           = require('path');
const rfs            = require('rotating-file-stream');
const moment         = require('moment');

async function main() 
{
    await survey_genesys.getSurveyFlowAndInsertData();
}
  
main()
