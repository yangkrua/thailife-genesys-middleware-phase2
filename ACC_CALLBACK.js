const genesys  = require('./app/functions/acc_gen_genesys.js');

async function main() 
{
    await genesys.Gen_ACC_CALLBACK();
    
}
  
main()