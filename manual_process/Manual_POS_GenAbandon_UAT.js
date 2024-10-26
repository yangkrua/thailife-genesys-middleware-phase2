const pos_genesys      = require('../app/functions/pos_genesys.js');

async function main() 
{
    let pDate = '2024-10-24';
    await pos_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
