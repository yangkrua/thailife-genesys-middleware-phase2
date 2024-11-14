
const genesys = require('./app/functions/acc_l_abandon_outbound.js');


async function main() {
    await genesys.GenAbandonOutbound();

}

main()
