const fs        = require('fs');
const path      = require('path');
const moment    = require('moment');

let removeFolderRecursive = (rootPath) => {
    if(fs.existsSync(rootPath)){
        fs.readdirSync(rootPath)
            .forEach((file, index) => {
                const curPath = path.join(rootPath,file);
                if(fs.lstatSync(curPath).isDirectory()){
                    const cureDate = moment();
                    const folderDate = moment(file);
                    const tts = cureDate.diff(folderDate, 'months');
                    if(tts > 1){
                        fs.rmdirSync(curPath);
                    }                    
                }
            });
    }
};


let removeLogFile_15d = (rootPath) => {
    if(fs.existsSync(rootPath)){
        fs.readdirSync(rootPath)
            .forEach((file, index) => {
                const curPath = path.join(rootPath,file);
                if(fs.lstatSync(curPath).isDirectory()){
                    removeLogFile_15d(curPath);                    
                }

                const stats = fs.statSync(curPath);
                duration = moment.duration(moment().diff(stats.birthtime));

                if( duration.asDays() > 15){
                    console.log('***Removed***, File=' + curPath);
                    fs.unlinkSync(curPath);
                }
            });
    }
};







module.exports = {
    removeFolderRecursive,
    removeLogFile_15d,
};

