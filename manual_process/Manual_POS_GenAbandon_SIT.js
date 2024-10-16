const pos_genesys      = require('../app/functions/pos_genesys.js');

async function main() 
{
    let pDate = '2024-10-03';
    await pos_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
