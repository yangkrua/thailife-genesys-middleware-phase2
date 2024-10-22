const acc_genesys      = require('../app/functions/acc_abandon_genesys.js');

async function main() 
{
    let pDate = '2024-10-19'
    await acc_genesys.ManualGenAbandonAccInb(await pDate,'SIT');
}
  
main()
