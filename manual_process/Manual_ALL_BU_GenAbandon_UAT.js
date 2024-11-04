const acc_genesys   = require('../app/functions/acc_abandon_genesys.js');
const bay_genesys   = require('../app/functions/bay_genesys.js');
const cc_genesys    = require('../app/functions/care_center_genesys.js');
const ccc_genesys   = require('../app/functions/ccc_genesys.js');
const ccd_genesys   = require('../app/functions/ccd_genesys.js');
const cimb_genesys  = require('../app/functions/cimb_genesys.js');
const crm_genesys   = require('../app/functions/crm_genesys.js');
const pos_genesys   = require('../app/functions/pos_genesys.js');
const ucc_genesys   = require('../app/functions/ucc_genesys.js');

async function main() 
{
    let pDate = '2024-11-01';

    await acc_genesys.ManualGenAbandonAccInb(await pDate, 'UAT');

    await bay_genesys.ManualGenAbandon(await pDate,'UAT');

    await cc_genesys.ManualGenAbandonCareCenter(await pDate,'UAT');

    await ccc_genesys.ManualGenAbandon(await pDate,'UAT');

    await ccd_genesys.ManualGenAbandon(await pDate,'UAT');

    await cimb_genesys.ManualGenAbandon(await pDate,'UAT');

    await crm_genesys.ManualGenAbandon(await pDate,'UAT');

    await pos_genesys.ManualGenAbandon(await pDate,'UAT');

    await ucc_genesys.ManualGenAbandon(await pDate,'UAT');
}
  
main()
