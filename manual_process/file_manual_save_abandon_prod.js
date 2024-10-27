const save_abandon      = require('../app/functions/manual_save_abandon.js');

async function main() 
{
    let fileName = 'abanList.txt'
    await save_abandon.ManualGenAbandon(fileName,'PROD');
}
  
main()
