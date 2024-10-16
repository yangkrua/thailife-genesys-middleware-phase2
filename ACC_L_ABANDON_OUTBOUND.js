// const log            = require("./app/functions/logger.js").LOG;
const config         = require('./app/config/server.js');
const genesys        = require('./app/functions/acc_gen_genesys.js');
const morganBody     = require('morgan-body');
const fs             = require('fs');
const path           = require('path');
const rfs            = require('rotating-file-stream');
const moment         = require('moment');

async function main() 
{
    await genesys.GenAbandonOutbound();
    
}
  
main()
