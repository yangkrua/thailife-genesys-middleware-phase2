const cimb_genesys      = require('../app/functions/cimb_genesys.js');

async function main() 
{
    let pDate = '2024-10-18';
    await cimb_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
