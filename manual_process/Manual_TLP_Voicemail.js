
const genesys      = require('../app/functions/tlp_genesys.js');

async function main() 
{
    let pDate = '2024-09-17';
    await genesys.Manual_Gen_VoiceMail(await pDate);
}
  
main()
