
const genesys = require('../app/functions/acc_voicemail.js');

async function main() {
    let pDate = '2024-10-22'
    await genesys.Manual_ACC_Voicemail(await pDate);
}

main()
