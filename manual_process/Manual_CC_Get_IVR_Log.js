const cc_genesys = require('../app/functions/ivr_logs.js');

async function main() {
    let pDate = '2024-10-21';
    await cc_genesys.Manual_Get_IVR_Log(await pDate);
}

main()
