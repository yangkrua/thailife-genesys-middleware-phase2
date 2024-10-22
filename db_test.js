
const dbservice =   require('./app/functions/acc_dbservice.js');

async function main() 
{
    await dbservice.testConnection();
    
}
  
main()