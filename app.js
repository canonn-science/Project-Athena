
var express = require("express");
var path = require("path");
var fs = require('fs');
var app = express();
var bodyParser = require('body-parser')
const request = require('request');

app.set('view engine', 'ejs');

var router = express.Router();



//https://api.canonn.tech/grartifact
//https://api.canonn.tech:2053/tssite

function sanitize(data){
	data.replace(/[^0-9A-Z]/g, "");
	return data;
}


function getReportInfo(reportName){
	var filePath = path.join(__dirname, 'models',reportName + '.settings.json');
	var model = JSON.parse(fs.readFileSync(filePath, 'utf8'));

	var info = {
		name:reportName,
		endpoint:'',
		title:'',
		fields:[]
	}

	info.endpoint = model.info.endpoint;
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

var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.get('/', function(req, res) {
	var info = getReportInfo('btreport');

    res.render('pages/index',{model:info});
});


// POST method route
app.all('/submit', urlencodedParser, function (req, res) {
	//Get the report name
	var reportName = sanitize(req.body.reportname);

	//Get the fields
	var info = getReportInfo(reportName);

	var reportRequest = {};

	

	//Populate the data and submit
	for(var i=0; i<info.fields.length; i++) {
		var input = info.fields[i];
		
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
	    	info.id = body.id;
	    	res.render('pages/submitted',{model:info});
		}
	});
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
	console.log("Listening on " + port);
});