
const genesys      = require('../app/functions/acc_gen_genesys.js');

async function main() 
{
    let pDate = '2024-10-18'
    await genesys.Manual_ACC_OUTB_Callback(await pDate);
}
  
main()
