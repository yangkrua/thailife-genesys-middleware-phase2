
const genesys        = require('./app/functions/tlp_genesys.js');

async function main() 
{
    await genesys.Gen_VOICEMAIL();
    
}
  
main()