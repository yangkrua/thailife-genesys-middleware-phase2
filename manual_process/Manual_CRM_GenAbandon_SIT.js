const crm_genesys      = require('../app/functions/crm_genesys.js');

async function main() 
{
    let pDate = '2024-09-30';
    await crm_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
