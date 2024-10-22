const survey_genesys      = require('../app/functions/survey_genesys.js');

async function main() 
{
    let pDate = '2024-10-19';
    await survey_genesys.ManualGetSurveyFlowAndInsertData(await pDate);
}
  
main()
