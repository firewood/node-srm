
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

function array_to_vector(s) {
	return s.replace(/(\w+)\[\]/g, function(m, tag) {
		return 'vector<' + tag + '>';
	});
}

function statement_to_code(path, statement, callback) {
	var r = {'Class:':'CLASSNAME', 'Method:':'METHODNAME', 'Parameters:':'METHODPARMS', 'Returns:':'RC', 'Method signature:':'METHODSIGNATURE'};
	var params = {};
	statement.split('<h3>').map(function(element) {
		if (element.match(/^Definition/)) {
			element.split('<tr>').map(function(element) {
				var a = td(element);
				if (a.length >= 2) {
					var key = a[0];
					if (r.hasOwnProperty(key)) {
						key = r[key];
					}
					params[key] = a[1];
				}
			});
		}
	});
	if (!params.hasOwnProperty('CLASSNAME')) {
		callback('No content');
		return;
	}

	var argtypes = params['METHODPARMS'].split(',');
	cout("method args", argtypes);
	var argvars = [];

	var i;
	var test_code = '// BEGIN CUT HERE\n';
	test_code += '	void run_test(string s) {\n';
	test_code += '		int pos = 0;\n';
	for (i = 0; i < argtypes.length; ++i) {
		var a = 'a' + i;
		var t = argtypes[i].trim();
		if (t.match(/(\w+)\[\]/)) {
			t = array_to_vector(t);
			test_code += '		' + t + ' ' + a + ' = parse_array<' + RegExp.$1 + '>(s, pos);\n';
		} else {
			test_code += '		' + t + ' ' + a + ' = parse<' + t + '>(s, pos);\n';
		}
		argvars.push(a);
	}
	test_code += '		$RC$ res = $METHODNAME$(' + argvars.join(', ') + ');\n';
	if (params['RC'].match(/(\w+)\[\]/)) {
		test_code += '		output_array<' + RegExp.$1 + '>(res);\n';
	} else {
		test_code += '		output(res);\n';
	}
	test_code += '	}\n';
	test_code += '// END CUT HERE\n';

	if (params.hasOwnProperty('METHODSIGNATURE')) {
		var args = params['METHODSIGNATURE'].replace(params['RC'] + ' ' + params['METHODNAME'], '');
		args = args.trim();
		args = args.substr(1, args.length - 2);
		args = array_to_vector(args);
		params['METHODPARMS'] = args;
	}
	params['RC'] = array_to_vector(params['RC']);

	fs.readFile('templates/class' + ext(), 'utf8', function(err, content) {
		if (!err) {
			content = content.replace("$TESTCODE$", test_code)
					.replace(/\x24([A-Z]+)\x24/g, function(m, tag) {
				if (params.hasOwnProperty(tag)) {
					return params[tag];
				}
				return '';
			});
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

