const genesys = require('./app/functions/acc_callback.js');

async function main() {
    await genesys.Gen_ACC_CALLBACK();

}

main()