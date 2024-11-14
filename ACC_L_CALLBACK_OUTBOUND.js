const genesys = require('./app/functions/acc_l_callback_outbound.js');

async function main() {
    await genesys.GenCallBackOutbound();

}

main()
