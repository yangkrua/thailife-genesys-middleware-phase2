
const survey_genesys = require('./app/functions/survey_genesys.js');

async function main() {
    await survey_genesys.getSurveyFlowAndInsertData();
}

main()
