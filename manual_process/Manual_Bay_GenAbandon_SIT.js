const bay_genesys      = require('../app/functions/bay_genesys.js');

async function main() 
{
    let pDate = '2024-10-18';
    await bay_genesys.ManualGenAbandon(await pDate,'SIT');
}
  
main()
