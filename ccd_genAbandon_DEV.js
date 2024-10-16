const ccd_genesys      = require('./app/functions/ccd_genesys.js');

async function main() 
{
    await ccd_genesys.genAbandon('DEV');
}
  
main()
