
const genesys = require('../app/functions/acc_l_callback_outbound.js');

async function main() {
    let pDate = '2024-10-23'
    await genesys.Manual_ACC_OUTB_Callback(await pDate);
}

main()
