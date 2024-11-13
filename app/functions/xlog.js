const fs = require('fs');
const path = require('path');

const winston = require('winston');
require('winston-daily-rotate-file');



function XLog(root_path, filename) {
    this._root_path = root_path;
    this._file_name = filename;

    this._options = {
        rotateFile: {
            level: 'debug',
            filename: `${this._root_path}/${this._file_name}`,
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "200m",
            maxFiles: "1d",
        },
        console: {
            level: 'debug',
            handleExceptions: true,
            json: false,
            zippedArchive: false,
            timestamp: function () {
                return Date.now();
            }
        },
    };

    this._transport_file = new winston.transports.DailyRotateFile(this._options.rotateFile);
    this._transport_file.on('rotate', function (oldFilename, newFilename) {
        logger.info({ 'message': 'New file created!' });
    });


    this._logger = new winston.createLogger({
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
        ),
        transports: [
            this._transport_file,
            new winston.transports.Console(this._options.console)
        ],
        exitOnError: false, // do not exit on handled exceptions
    });
}

XLog.prototype.init = function () {
    try {
        const pathToCreate = this._root_path;
        pathToCreate
            .split(path.sep)
            .reduce((prevPath, folder) => {
                const currentPath = path.join(prevPath, folder, path.sep);
                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath);
                }
                return currentPath;
            }, '');
    } catch (error) {
        console.log(`init(), error: ${error}`);
    }
}

XLog.prototype.info = function (text) {
    this._logger.info(text);
}

XLog.prototype.error = function (text) {
    this._logger.error(text);
}

module.exports = XLog;