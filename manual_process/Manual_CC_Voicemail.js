const cc_genesys      = require('../app/functions/care_center_genesys.js');

async function main() 
{
    let pDate = '2024-08-20'
    await cc_genesys.Manual_CC_Voicemail(await pDate);
}
  
main()
