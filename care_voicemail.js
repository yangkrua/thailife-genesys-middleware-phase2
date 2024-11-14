

const genesys = require('./app/functions/care_voicemail.js');

async function main() {
    await genesys.Gen_CARE_VOICEMAIL();

}

main()