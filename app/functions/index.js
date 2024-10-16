const request = require('request');


const httpRequest = function(options) {
    return new Promise((resolve,reject) => {
    request(options, (error, response, body) => {
        if (response) {
            console.log(`httpRequest(), ok!, result: ${response.body}`);
            return resolve(response);
        }
        if (error) {
            console.log(`httpRequest(), error: ${error.message}`);
            return reject(error);
        }
        });
    });
};


let validateMemberID = (memberID) => {
    let regExp = /^(((C|c|Y|y){0,1}[0-9]{8})|([0-9]{12})|([0-9]{9}))$/;
    return regExp.test(memberID);
};

let validateTaxID = (taxID) => {
    let regExp;
    return true;
};

let parserPolicyNumber = (inputText) => {
    let regExp = /[^PolicyNo: ]*[0-9]{12}/;
    var arr = regExp.exec(inputText)  || [""];
    return arr[0].trim();
};

let parserCustomerName = (inputText) => {
    let regExp = /(?<=CustomerName:)(.*)(?= PaymentMethod:)/g;
    var arr = regExp.exec(inputText) || [""];
    return arr[0].trim();
};

let parserPaymentMethod = (inputText) => {
    let regExp = /(?<=PaymentMethod: )(.*)/g;
    var arr = regExp.exec(inputText) || [""];
    return arr[0].trim();
};

module.exports = {
    validateMemberID,
    validateTaxID,
    parserPolicyNumber,
    parserCustomerName,
    parserPaymentMethod,
    httpRequest,

};