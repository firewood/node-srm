
var cout = console.out = function() {
	var msg = "";
	for (var i = 0; i < arguments.length; ++i) {
		if (msg) {
			msg += ", ";
		}
		var a = arguments[i];
		switch (typeof a) {
		case "number":
		case "string":
			msg += a;
			break;
		default:
			msg += JSON.stringify(a);
			break;
		}
	}
	console.log(msg);
}

/**
 * Module dependencies.
 */

var express = require('express'),
	fs = require('fs');

var app = module.exports = express.createServer();
var config;
var round;

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes
app.get('/', function(req, res) {
	res.render('index', { title: 'Node-SRM' });
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

fs.readFile('./config.json', 'utf8', function(err, content) {
	try {
		config = JSON.parse(content);
	} catch (e) {
		cout("config.json is not found or broken");
		process.exit();
	}

	var language = config['language'];
	if (language.match(/java/i)) {
		language = 'java';
	} else if (language.match(/(c#|csharp)/i)) {
		language = 'c#';
	} else if (language.match(/(c\+\+|cpp|cplusplus)/i)) {
		language = 'c++';
	} else {
		cout("Please set valid language in config.json either one of java/c#/c++.");
		process.exit();
	}
	config['language'] = language;

	if (!config.hasOwnProperty('code_gen_path')) {
		config['code_gen_path'] = 'public/srm';
	}

	round = require('./round')({app:app, config:config});
});

