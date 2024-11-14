
const genesys = require('../app/functions/acc_l_abandon_outbound.js');

async function main() {
    let pDate = '2024-10-19'
    await genesys.Manual_ACC_OUTB_Abandon(await pDate);
}

main()
