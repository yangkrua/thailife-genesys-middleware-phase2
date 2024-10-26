const ccc_genesys      = require('../app/functions/ccc_genesys.js');

async function main() 
{
    let pDate = '2024-10-24';
    await ccc_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
