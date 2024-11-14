const ccd_genesys = require('./app/functions/ccd_gen_abandon.js');

async function main() {
    await ccd_genesys.genAbandon('PROD');
}

main()
