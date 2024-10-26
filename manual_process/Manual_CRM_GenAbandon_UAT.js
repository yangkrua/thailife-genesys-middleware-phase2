const crm_genesys      = require('../app/functions/crm_genesys.js');

async function main() 
{
    let pDate = '2024-10-24';
    await crm_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
