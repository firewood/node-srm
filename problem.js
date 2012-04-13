
var cout = console.out;
var fs = require('fs');
var app;
var config;

function ext() {
	var e = '.cpp';
	switch (config.language) {
	default:
		break;
	}
	return e;
}

function td(tr) {
	var a = [];
	tr.split('</td>').map(function(element) {
		if (element.match(/<td[^>]*>(.*)/)) {
			a.push(RegExp.$1);
		}
	});
	return a;
}

function statement_to_code(path, statement, callback) {
	var params = {};
	statement.split('<h3>').map(function(element) {
		if (element.match(/^Definition/)) {
			element.split('<tr>').map(function(element) {
				var a = td(element);
				if (a.length >= 2) {
					params[a[0]] = a[1];
				}
			});
		}
	});

	fs.readFile('templates/class' + ext(), 'utf8', function(err, content) {
		if (!err) {
			content = content.replace('$CLASSNAME$', params['Class:'])
				.replace('$METHODNAME$', params['Method:'])
				.replace('$METHODPARMS$', params['Parameters:'])
				.replace('$WRITERCODE$', '')
				.replace('$TESTCODE$', '');

			fs.writeFile(path, content, function(err) { });
		}
		callback(err, content);
	});
}

module.exports = function(options) {
	app = options.app;
	config = options.config;
	return {ext:ext, statement_to_code:statement_to_code};
}
