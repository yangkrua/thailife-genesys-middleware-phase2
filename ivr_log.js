
const genesys        = require('./app/functions/care_center_genesys.js');

async function main() 
{
    await genesys.Gen_IVR_Log();
    
}
  
main()