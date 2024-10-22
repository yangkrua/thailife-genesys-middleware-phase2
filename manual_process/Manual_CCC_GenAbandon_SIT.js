const ccc_genesys      = require('../app/functions/ccc_genesys.js');

async function main() 
{
    let pDate = '2024-10-20';
    await ccc_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
