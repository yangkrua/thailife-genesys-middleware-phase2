const ucc_genesys      = require('../app/functions/ucc_genesys.js');

async function main() 
{
    let pDate = '2024-10-24';
    await ucc_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
