const crm_genesys      = require('../app/functions/crm_genesys.js');

async function main() 
{
    let pDate = '2024-10-18';
    await crm_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
