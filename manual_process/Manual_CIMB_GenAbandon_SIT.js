const cimb_genesys      = require('../app/functions/cimb_genesys.js');

async function main() 
{
    let pDate = '2024-10-03';
    await cimb_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
