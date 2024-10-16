const acc_genesys      = require('./app/functions/acc_abandon_genesys.js');

async function main() 
{
    await acc_genesys.genAbandonAccInb('SIT');
}
  
main()
