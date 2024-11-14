const bay_genesys = require('./app/functions/bay_genesys.js');

async function main() {
    await bay_genesys.genAbandon('PROD');
}

main()
