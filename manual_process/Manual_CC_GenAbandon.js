const cc_genesys = require('../app/functions/care_center_genabandon.js');

async function main() {
    let pDate = '2024-08-20'
    await cc_genesys.ManualGenAbandonCareCenter(await pDate);
}

main()
