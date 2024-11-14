const cc_genesys = require('../app/functions/care_callback.js');

async function main() {
    let pDate = '2024-10-24'
    await cc_genesys.Manual_CC_Callback(await pDate);
}

main()
