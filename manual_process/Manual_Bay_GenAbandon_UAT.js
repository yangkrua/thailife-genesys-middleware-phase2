const bay_genesys      = require('../app/functions/bay_genesys.js');

async function main() 
{
    let pDate = '2024-10-24';
    await bay_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
