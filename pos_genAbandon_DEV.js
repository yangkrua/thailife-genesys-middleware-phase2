const pos_genesys      = require('./app/functions/pos_genesys.js');

async function main() 
{
    await pos_genesys.genAbandon('DEV');
}
  
main()
