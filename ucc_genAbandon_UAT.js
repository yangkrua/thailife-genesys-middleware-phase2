const ucc_genesys      = require('./app/functions/ucc_genesys.js');

async function main() 
{
    await ucc_genesys.genAbandon('UAT');
}
  
main()
