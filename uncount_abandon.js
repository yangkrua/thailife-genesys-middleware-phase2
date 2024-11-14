const genesys = require('./app/functions/uncount_abandon_func.js');

async function main() {

    let pDate = '2024-10-22'
    await genesys.uncount_abandon_process(pDate);
}

main()
