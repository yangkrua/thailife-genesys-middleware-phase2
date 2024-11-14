const ccc_genesys = require('./app/functions/ccc_gen_abandon.js');

async function main() {
    await ccc_genesys.genAbandon('PROD');
}

main()
