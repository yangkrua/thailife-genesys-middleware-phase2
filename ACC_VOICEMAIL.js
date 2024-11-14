
const genesys = require('./app/functions/acc_voicemail.js');

async function main() {
    await genesys.Gen_ACC_VOICEMAIL();

}

main()