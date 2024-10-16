const ccd_genesys      = require('../app/functions/ccd_genesys.js');

async function main() 
{
    let pDate = '2024-09-17';
    await ccd_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
