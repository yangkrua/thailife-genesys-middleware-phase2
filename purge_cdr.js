const utils   = require('./app/functions/utils');
const config  = require('./app/config/server');

async function main() 
{
    const rootPath = config.GENESES.data_process_outbox;
    await utils.removeFolderRecursive(rootPath);

    const logPath = './logs';
    await utils.removeLogFile_15d(logPath);
}
  
main()
