var express = require("express");
var path = require("path");
var fs = require('fs');
var app = express();

app.set('view engine', 'ejs');

var router = express.Router();

app.get('/', function(req, res) {

	var info = {
		endpoint:'',
		title:'',
		fields:[]
	}

	var filePath = path.join(__dirname, 'models','btreport' + '.settings.json');
	var model = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	
	info.endpoint = model.info.endpoint;
	info.title = model.info.description;
	
	for(var attrName in model.attributes) {
		var attr = model.attributes[attrName];
		var field = {
				name:attrName,
				description:attr['x-data-description'] || attrName,
				type:attr.type || 'string',
				required: attr.required || false,
				default: attr.default || '',
				render: attr.hasOwnProperty("x-data-render")? attr['x-data-render'] : true
			}
		
		info.fields.push(field);
	}


	//res.send(info);

    res.render('pages/index',{model:info});
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
	console.log("Listening on " + port);
});