
var express = require("express");
var path = require("path");
var fs = require('fs');
var app = express();
var bodyParser = require('body-parser')
const request = require('request');

app.set('view engine', 'ejs');

var router = express.Router();
var urlencodedParser = bodyParser.urlencoded({ extended: false })

//Get the models
var appInfo = {
	online:false,
	models:getModels(path.join(__dirname, 'models'))
}

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
			request('https://api.canonn.tech:2083/' + reportName, { json: true, method: 'POST', body: reportRequest}, function (err, response, body) {
			    if (err) {
					console.log('Error');
					console.log(err);
					res.send('There was an error');
			    }else if(response.statusCode != 200){
			    	
			    	console.log('Failed request:' + response.statusCode + ' ' + response.message);
					res.send('Failed request:' + response.statusCode + ' ' + response.message);
			    }else{
			    	modelInfo.id = body.id;
			    	res.render('pages/submitted',{model:modelInfo});
				}
			});


		}
	});	
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
	console.log("Listening on " + port);
});



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
getModels - Retrieve the models 
Inputs - Path
Outputs - Array of models
Callbacks - None
***************************************************************************************/
function getModels(modelPath){
	var models = {};
	var files = fs.readdirSync(modelPath);

	for (var i=0; i<files.length; i++) {
    	var modelName = files[i];

    	if(modelName.indexOf('report.settings.json') > -1) {
    		//Load the model information
    		var modelInfo = getModelInfo(path.join(modelPath,modelName))
    		models[modelInfo.name]=modelInfo;
		}
    }

    return models;
}

/***************************************************************************************
getModelInfo - Parse the report model information 
Inputs - Full path to the file
Outputs - Report information
Callbacks - None
***************************************************************************************/
function getModelInfo(modelFile){
	var model = JSON.parse(fs.readFileSync(modelFile, 'utf8'));

	var info = {
		name:'',
		endpoint:'',
		description:'',
		fields:[]
	}

	info.endpoint = model.info.endpoint;
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