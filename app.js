
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
	events = require('events'),
	fs = require('fs'),
	exec = require('child_process').exec,
	util = require("util");

var app = module.exports = express.createServer();
var config;
var round;
var problem;

function Watcher() {
	this.interval = 1000;
	events.EventEmitter.call(this);
}
util.inherits(Watcher, events.EventEmitter);
Watcher.prototype.watch = function(file) {
	cout("watch: " + file);

	if (this.w) {
		this.w.close();
		this.f = this.w = undefined;
	}
	var self = this;
	this.f = file;
	this.w = fs.watch(file, function(ev, filename) {
		if (!self.b) {
			self.b = true;
			setTimeout(function() { self.emit('modified', file); self.b = false; }, 100);
		}
	});
};
var watcher = new Watcher();

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

var io = require('socket.io').listen(app);
io.set('log level', 1);
io.sockets.on('connection', function(socket) {
	cout('CONNECTED');
	var cb = function(tag) {
		return function(msg) {
			socket.emit(tag, msg);
		};
	};
	var outcb = cb('stdout');
	var errcb = cb('stderr');
	var syscb = cb('systest');
	watcher.on('stdout', outcb);
	watcher.on('stderr', errcb);
	watcher.on('systest', syscb);

	socket.on('disconnect', function() {
		cout('DISCONNECTED');
		watcher.removeListener('stdout', outcb);
		watcher.removeListener('stderr', errcb);
		watcher.removeListener('systest', syscb);
	});
});

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

	problem = require('./problem')({app:app, config:config, watcher:watcher});
	round = require('./round')({app:app, config:config, problem:problem, watcher:watcher});
	round.init();

	app.get('/getRound', round.get);
	app.get('/getProblem', problem.get);
	app.get('/runSystemTests', round.run);
});

watcher.on('modified', function(file) {
	cout('modified', file);

	var child = exec('g++ ' + file + ' -o ' + file.replace('.cpp', ''), function(err, stdout, stderr) {
		if (stdout) {
			watcher.emit('stdout', stdout);
		}
		var errmsg = '';
		if (err) {
			errmsg += err.toString();
		}
		if (stderr) {
			errmsg += stderr.toString();
		}
		if (errmsg) {
			var lines = errmsg.split('\n');
			var i;
			for (i = 0; i < lines.length; ++i) {
				var l = lines[i].trim();
				if (l) {
					watcher.emit('stderr', l);
				}
			}
		}
	});
	child.on('exit', function() {
		watcher.emit('stdout', 'Build done');
	});
});

/*
process.on('uncaughtException', function(err) {
	cout('uncaught Exception', err);
	console.dir(err);
});
*/

