var express = require("express");
var path = require("path");
var fs = require('fs');
//const request = require('request');
var rp = require('request-promise');

//Application info
var appInfo = {
	online:false,
	models:{}
}

//Default
var address = 'api.canonn.tech';

//Change address?
if(process.env.NODE_ENV === 'development'){
	//Development
	address = 'api.canonn.tech:2083';
}else if(process.env.NODE_ENV === 'staging'){
	//Staging
	address = 'api.canonn.tech:2053';	
}

// Get the directory
fetchJSON('https://' + address + '/models/directory.json') //Get the directory
.then(result => { //Now get the model files
	
	var reportsData = Object.keys(result.reports).map(key => ({
        modelName: key, modelAddress: result.reports[key]
    }));


	const promises = reportsData.map(async reportInfo => {
	    //Fetch and set our models
	    var modelInfo = await fetchJSON('https://' + address + '/models/' + reportInfo.modelAddress);

	    appInfo.models[reportInfo.modelName] = parseModelInfo(modelInfo);

	    return appInfo.models;
	  })

	// wait until all promises resolve
	return Promise.all(promises);

}).then(function(){
	serverListen();
}).catch(function(err){
	logError('critical',err);
	process.exit(9);
})

/***************************************************************************************
serverListen - Start the server to accept connections
Inputs - None
Outputs - None
***************************************************************************************/
function serverListen(){

	//Setup express
	var app = express();
	var bodyParser = require('body-parser')

	var port = process.env.PORT || 5000;
	app.set('view engine', 'ejs');

	var router = express.Router();
	var urlencodedParser = bodyParser.urlencoded({ extended: false })

	//Have models?

	if(Object.keys(appInfo.models).length > 0){
		appInfo.online = true;
	}

	/***************************************************************************************
	Route / 
	***************************************************************************************/
	app.get('/', function(req, res) {
		//Offline?
		if(false === appInfo.online){
			return res.render('pages/offline');
		}

		var reportItems = [];

		//Add each key
		Object.keys(appInfo.models).forEach(function(key) {
			var reportModel = appInfo.models[key];

			reportItems.push({name:reportModel.name,display:reportModel.title});
		});


		res.render('pages/index',{reports:reportItems});
	});


	app.get('/report/:reportname', function(req, res) {
		//Offline?
		if(false === appInfo.online){
			return res.render('pages/offline');
		}

		//Get the report name
		getModelByName(req.params.reportname,function(modelInfo,err){
			if(err){
				//Unable to find the model
				res.send('There was an error.  Can\'t find the requested report');
			}else{
				//Get the model
				res.render('pages/report',{model:modelInfo});
			}
		});
	});


	// POST method route
	app.all('/submit/:reportname', urlencodedParser, function (req, res) {
		//Offline?
		if(false === appInfo.online){
			return res.render('pages/offline');
		}

		var reportName = sanitizeAlphaNumeric(req.params.reportname);

		//Get the report name
		getModelByName(reportName,function(modelInfo,err){
			if(err){
				//Unable to find the model
				res.send('There was an error.  Can\'t find the requested report');
			}else{
				var reportRequest = {};

				//Populate the data and submit
				for(var i=0; i<modelInfo.fields.length; i++) {
					var input = modelInfo.fields[i];
					
					if(false == input.exclude){
						var val = req.body['fld-' + input.name] || input.default;

						if(input.type == 'boolean'){
							val = (val == 'true');
						}else if(input.type == 'integer'){
							val = parseInt(val);
						}else if(input.type == 'float'){
							val = parseFloat(val);
						}

						reportRequest[input.name]=val;	
					}
				}

				//Send data
				fetchJSON('https://api.canonn.tech:2083/' + modelInfo.endpoint,{ method: 'POST', body: reportRequest}).then(function (response) {
					//Post succeeded
					modelInfo.id = response.id;
					res.render('pages/submitted',{model:modelInfo});
					return 1;
	    		}).catch(function(errResponse){
	    			//Post failed
	    			res.send('Failed request from remote API:' + errResponse.error.statusCode + ' ' + errResponse.error.message);
	    			return 0;

	    		})
		


			}
		});	
	});


	app.listen(port, function() {
		console.log("Listening on " + port);
	});


}


/***************************************************************************************
logError - Log the error information
Inputs - Error type, error object
Outputs - None
***************************************************************************************/
function logError(errType, err){
	console.log('---' + errType + '---');
	console.error(err);
	console.log('--------------------');
}


/***************************************************************************************
fetchJSON - Make a JSON request
Inputs - address to fetch, optional arguments
Outputs - Promise
Callbacks - None
***************************************************************************************/
async function fetchJSON(fromAddress,args){
	var options = {uri:fromAddress, json:true};
	if (args){
		for(arg in args){
			options[arg] = args[arg];
		}
	}
    return rp(options);
}



/***************************************************************************************
getModelByName - Retrieve the given model
Inputs - model Name
Outputs - The model
Callbacks - function(model,err)
***************************************************************************************/
function getModelByName(reportName,callback){
	//Get the report name
	var reportName = sanitizeAlphaNumeric(reportName);

	//Have the associated model?
	var modelInfo = appInfo.models[reportName];

	callback(modelInfo,(modelInfo === undefined));
}


/***************************************************************************************
parseModelInfo - Parse the report model information 
Inputs - model string
Outputs - Report information
Callbacks - None
***************************************************************************************/
function parseModelInfo(model){
	var info = {
		name:'',
		endpoint:'',
		description:'',
		fields:[]
	}

	//Get the endpoint and cleanup preceding path separators in the URI
	info.endpoint = model.info.endpoint.replace(/^\//,'');

	info.name = model.info.name;
	info.title = model.info.description;
	
	for(var attrName in model.attributes) {
		var attr = model.attributes[attrName];

		var field = {
				name:attrName,
				description:attr['x-data-description'] || attrName,
				type:attr['x-data-type'] || attr.type || 'string',
				required: attr.required || false,
				default: (attr.default === undefined)? '' : attr.default,
				exclude: attr['x-data-exclude'] || false,
				render: attr.hasOwnProperty("x-data-render")? attr['x-data-render'] : true
			}

		if(attr['x-data-usersend'] === false){
			field.exclude = true;
		}

		if(attr.type == "enumeration"){
			field.enum = [];
			var enumList = attr.enum || [];

			for(item of enumList){
				field.enum.push({val:item,display:item})
			}
		
		}

		
		
		info.fields.push(field);
	}

	return info;
}

/***************************************************************************************
sanitizeAlphaNumeric - Sanitize the given string to ensure only alpha numeric allowed 
Inputs - data to sanitize
Outputs - sanitized string
Callbacks - None
***************************************************************************************/
function sanitizeAlphaNumeric(data){
	data.replace(/[^0-9A-Z]/g, "");
	return data;
}
