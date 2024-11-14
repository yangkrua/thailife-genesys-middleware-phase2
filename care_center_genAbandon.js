const cc_genesys = require('./app/functions/care_center_genabandon.js');

async function main() {
    await cc_genesys.genAbandonCareCenter('PROD');
}

main()
