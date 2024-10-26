const acc_genesys      = require('../app/functions/acc_abandon_genesys.js');

async function main() 
{
    let pDate = '2024-10-24'
    await acc_genesys.ManualGenAbandonAccInb(await pDate,'UAT');
}
  
main()
