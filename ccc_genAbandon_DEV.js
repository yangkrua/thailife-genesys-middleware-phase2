const ccc_genesys      = require('./app/functions/ccc_genesys.js');

async function main() 
{
    await ccc_genesys.genAbandon('DEV');
}
  
main()
