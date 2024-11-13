const xlog = require('./xlog.js')

const log = new xlog('./logs/ACC_CRM', 'test.log');
log.init();
log.info("====test===");
log.error("===test-error====");