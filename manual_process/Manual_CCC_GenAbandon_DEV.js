const ccc_genesys      = require('../app/functions/ccc_genesys.js');

async function main() 
{
    let pDate = '2024-09-17';
    await ccc_genesys.ManualGenAbandon(await pDate,'DEV');
}
  
main()
