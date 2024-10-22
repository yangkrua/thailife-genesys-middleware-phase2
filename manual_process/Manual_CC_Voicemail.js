const cc_genesys      = require('../app/functions/care_center_genesys.js');

async function main() 
{
    let pDate = '2024-10-21'
    await cc_genesys.Manual_CC_Voicemail(await pDate);
}
  
main()
