const cc_genesys      = require('./app/functions/care_center_genesys.js');

async function main() 
{
    await cc_genesys.genAbandonCareCenter('DEV');
}
  
main()
