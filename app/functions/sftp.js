const config = require('../config/server');
const log    = require("../functions/logger").LOG;
const Client = require('ssh2-sftp-client');
const Q      = require('q');
const _      = require('lodash');

function Sftp(){
    this.sftp   = new Client();     
}

Sftp.prototype.login = function(){
    let deferred = Q.defer();

    if(!config.SFTP.host || !config.SFTP.port || config.SFTP.username === '' || config.SFTP.password === ''){
        deferred.reject(new Error('Authentication error: Username not set'));
        return deferred.promise;
    }

    this.sftp.connect({
        host: config.SFTP.host,
        port: config.SFTP.port,
        username: config.SFTP.username,
        password: config.SFTP.password
    }).then(() => {
        log.info('sftp->connect(), success fully!');
        return deferred.resolve();
    }).catch((error) => {
        log.error(`sftp->connect(), error: ${error.message}`);  
        let e = new Error(`sftp->connect(), error: ${error.message}`);
        return deferred.reject(e);
    });
    
    return deferred.promise;
}

Sftp.prototype.disconnect = function() {
    try{
        this.sftp.end();
    }catch(error){
        log.error(`sftp->disconnect(), error: ${error.message}`);                        
    }
}

Sftp.prototype.listFiles = function(path, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;
    
    _this.sftp.list(path)
         .then((data) => {
            return deferred.resolve(data);    
        })
        .catch((err) =>{
            let e = new Error(`sftp->list(), error: ${err.message}`);
            log.error(e.message); 
            return deferred.reject(e);
        });
        
    return deferred.promise;
}

Sftp.prototype.downloadFile = function(remoteFile, localFile, deferred, _this){
    
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.fastGet(remoteFile, localFile)
         .then(() => {
            log.info('sftp->download(), success fully!');
            return deferred.resolve();
         })
         .catch((err) =>{
            let e = new Error(`sftp->downloadFile(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);
         });
         
         return deferred.promise;
}

Sftp.prototype.uploadFile = function(localFile, remoteFile, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.put(localFile, remoteFile)
         .then(() =>{
            log.info('sftp->upload(), success fully!');       
            return deferred.resolve();
        }).catch((error) => {
            let e = new Error(`sftp->uploadFile(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
        });
        
        return deferred.promise;
}

Sftp.prototype.mkdir = function(path, deferred, _this) {
    
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.mkdir(path)
         .then((data) => {
            return deferred.resolve(data);
         })
         .catch(err => {
            let e = new Error(`sftp->mkdir(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
         })

        return deferred.promise;
}

Sftp.prototype.rmdir = function(remotePath, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.rmdir(remotePath)
         .then((data) => {
            return deferred.resolve(data);
         })
         .catch(err =>{
            let e = new Error(`sftp->rmdir(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
         });
    
    return deferred.promise;
}

Sftp.prototype.deleteFile = function(remoteFile, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.delete(remoteFile)
         .then((data) =>{
            return deferred.resolve(data);
         })
         .catch(err => {
            let e = new Error(`sftp->delete(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
         });

    return deferred.promise;
}

Sftp.prototype.rename = function(remotePath, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.rename(remotePath)
         .then((data) => {
            return deferred.resolve(data);
         })
         .catch(err =>{
            let e = new Error(`sftp->rename(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
         });
    return deferred.promise;
}

Sftp.prototype.chmod = function(remotePath, mode, deferred, _this){
    if (!deferred) 
		deferred = Q.defer();
	if (!_this)
		_this = this;

    _this.sftp.chmod(remotePath,mode)
         .then((data) =>{
            return deferred.resolve(data);
         })
         .catch(err =>{
            let e = new Error(`sftp->rename(), error: ${err.message}`); 
            log.error(e.message);
            return deferred.reject(e);  
         });
    
    return deferred.promise;
}

module.exports =  new Sftp();
