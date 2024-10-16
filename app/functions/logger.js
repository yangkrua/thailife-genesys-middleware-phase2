const config   = require('../config/server');
//const { path } = require('app-root-path');
var winston    = require('winston');
require('winston-daily-rotate-file');

var options = {
  rotateFile: {    
    level: 'debug',
    filename: config.WinstonLogger.filename,
    datePattern: config.WinstonLogger.datePattern,
    zippedArchive: config.WinstonLogger.zippedArchive,
    maxSize: config.WinstonLogger.maxSize,
    maxFiles: config.WinstonLogger.maxFiles
  },  
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,    
    zippedArchive: false,
    timestamp: function(){
    return Date.now();
    } 
  },
};

var transport_file = new winston.transports.DailyRotateFile(options.rotateFile);
transport_file.on('rotate', function(oldFilename, newFilename) {
  logger.info({'message':'New file created!'});  
});



var logger = new winston.createLogger({
  format: winston.format.combine(    
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [    
    transport_file,
    new winston.transports.Console(options.console)
  ],
  exitOnError: false, // do not exit on handled exceptions
});


//Export Object
Object.defineProperty(exports, "LOG", {value: logger});
