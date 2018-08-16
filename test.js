
/*
var HttpsProxyAgent = require('https-proxy-agent');
var proxy = 'http://127.0.0.1:8888';
var agent = new HttpsProxyAgent(proxy);
*/

const request = require('request');

var requestData = {
  "systemName": "Sol",
  "bodyName": "Earth",
  "latitude": 1,
  "longitude": 2,
  "count": 3,
  "cmdrName": "AdmlAdama",
  "cmdrComment": "Commander Comment",
  "reportStatus": "pending",
  "reportComment": "Report Comment",
  "voteCount": 0,
  "added": true,
  "site": 0
};

request(
  'https://api.canonn.tech:2083/btreport', 
  { 
    json: true, 
    body: requestData,
    //agent: agent,
    //"rejectUnauthorized": false, //required for proxy
    method: 'POST' 
  }, function (err, response, body) {
    if (err) {
      console.log('Error');
      console.log(err);
    }else if(response.statusCode != 200){
      console.log('Failed request:' + response.statusCode + ' ' + response.message);
    }else{
      console.log(body);      
    }
});

