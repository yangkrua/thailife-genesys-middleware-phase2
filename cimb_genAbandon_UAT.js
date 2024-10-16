const cimb_genesys      = require('./app/functions/cimb_genesys.js');

async function main() 
{
    await cimb_genesys.genAbandon('UAT');
}
  
main()
