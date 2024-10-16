// const log            = require("./app/functions/logger.js").LOG;
const qmService        = require('../app/functions/qualityManagementImpl.js');


async function main() 
{

    let pDateStart = '2024-09-17';
    let pDateEnd = '2024-09-17';
    await qmService.manualGetEvaluationInfomation(pDateStart,pDateEnd);
    
}
  
main()