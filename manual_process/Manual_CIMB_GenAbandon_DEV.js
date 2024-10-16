const cimb_genesys      = require('../app/functions/cimb_genesys.js');

async function main() 
{
    let pDate = '2024-09-17';
    await cimb_genesys.ManualGenAbandon(await pDate,'DEV');
}
  
main()
