const cc_genesys      = require('../app/functions/care_center_genesys.js');

async function main() 
{
    let pDate = '2024-10-18';
    await cc_genesys.ManualGenAbandonCareCenter(await pDate,'SIT');
}
  
main()
