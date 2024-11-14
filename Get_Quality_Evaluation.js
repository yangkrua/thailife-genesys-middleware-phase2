
const qmService = require('./app/functions/qualityManagementImpl.js');


async function main() {
    await qmService.getEvaluationInfomation();

}

main()