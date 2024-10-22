const crm_genesys      = require('./app/functions/crm_genesys.js');

async function main() 
{
    await crm_genesys.genAbandon('PROD');
}
  
main()
