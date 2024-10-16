const cc_genesys      = require('../app/functions/care_center_genesys.js');

async function main() 
{
    let pDate = '2024-09-17';
    await cc_genesys.ManualGenAbandonCareCenter(await pDate,'DEV');
}
  
main()
