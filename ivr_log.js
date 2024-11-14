
const genesys = require('./app/functions/ivr_logs.js');

async function main() {
    await genesys.Gen_IVR_Log();

}

main()