
var cout = console.out;
var async = require('async'),
	fs = require('fs'),
	spawn = require('child_process').spawn;

var problem_url = 'http://community.topcoder.com/stat?c=problem_statement';
var problem_detail_url = 'http://community.topcoder.com/tc?module=ProblemDetail';
var problem_solution_url = 'http://community.topcoder.com/stat?c=problem_solution';
var statement_ext = '.html';
var test_argst_ext = '.json';

var app;
var config;
var download;
var watcher;
var srm_problems = {};

function update_list(list) {
//	cout("SRM problems", list);
	srm_problems = list;
}

function array_to_json(a) {
	var j = '[';
	for (var i = 0; i < a.length; ++i) {
		if (i > 0) {
			j += ',\n';
		}
		j += JSON.stringify(a[i]);
	}
	j += ']\n';
	return j;
}

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

function trim_statement(content) {
	var f = false;
	return content.split('\n')
			.filter(function(element, index, array) {
		if (element.match(/<!-- BEGIN BODY -->/)) {
			f = true;
		}
		if (element.match(/<!-- END BODY -->/)) {
			f = false;
		}
		return f;
	}).map(function(element) {
		if (element.match(/(.*<TABLE)/)) {
			element = RegExp.$1 + '>';
		}
		return element;
	}).join('\n');
}

function statement_to_code(filename, statement, callback) {
	var r = {'Class:':'CLASSNAME', 'Method:':'METHODNAME', 'Parameters:':'METHODPARMS',
			'Returns:':'RC', 'Method signature:':'METHODSIGNATURE'};
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
			fs.writeFile(filename, content);
		}
		callback(err);
	});
}

function evaluate(expected, result) {
	if (result.match(/^[.\d]+$/)) {
		if (expected.match(/^".*"$/)) {
			expected = expected.substr(1, expected.length - 2);
		}
		return Math.abs(expected - result) <= 0.000000001;
	}
	return expected == result;
}

function invoke(program_path, json) {
	child = spawn(program_path);
	child.on('exit', function() {
		cout('Terminated');
	});

	var tests = json.length;
	var success = 0;
	async.forEachSeries(json, function (x, callback) {
		var expected = x[0];
		var args = x[1].join(',');
		child.stdout.on('data', function(data) {
			child.stdout.removeAllListeners('data');
			var res = data.toString().trim();
//			watcher.emit('stdout', 'args: ' + JSON.stringify(args) + ', result: ' + res);
			if (evaluate(expected, res)) {
				++success;
				watcher.emit('systest', JSON.stringify({code:1, res:res}));
				callback();
			} else {
				watcher.emit('systest', JSON.stringify({code:0, res:res}));
				callback('FAILED');
			}
		});
//		watcher.emit('stdout', 'Testing: ' + args);
//		child.stdin.write(args + '\n');
		setTimeout(function() { child.stdin.write(args + '\n'); }, 10);
	}, function (err, result) {
		var msg = "results: " + success + '/' + tests;
		cout(msg);
		watcher.emit('stdout', msg);

		child.stdout.removeAllListeners('data');
		child.stdin.end();
	});
}

function download_srm_problem_statement(round_id, problem_id, path, callback) {
	var statement_filename = path + statement_ext;
	fs.readFile(statement_filename, 'utf8', function(err, html) {
		if (!err) {
			cout("Problem cached", statement_filename);
			callback(null, html);
			return;
		}

		cout("Downloading problem statement...");
		var target_url = problem_url + '&pm=' + problem_id + '&rd=' + round_id;
		download.get(target_url, null, function(err, content) {
			var statement;
			if (!err && content) {
				statement = '<html><body>\n' + trim_statement(content.body) + '</body></html>\n';
				fs.writeFile(statement_filename, statement);
			}
			callback(err, statement);
		});
	});
}

function generate_code(path, statement, callback) {
	var filename = path + ext();
	fs.readFile(filename, 'utf8', function(err, code) {
		if (!err) {
			callback();
			return;
		}
		statement_to_code(filename, statement, callback);
	});
}

function download_srm_system_test_results(round_id, problem_id, path, callback) {
	var filename = path + test_argst_ext;
	fs.readFile(filename, 'utf8', function(err, data) {
		if (!err) {
			json = JSON.parse(data);
			if (json) {
				callback();
				return;
			}
		}

		cout("Downloading problem detail...");
		var target_url = problem_detail_url + '&pm=' + problem_id + '&rd=' + round_id;
		download.get(target_url, null, function(err, content) {
			if (err) {
				callback(err);
				return;
			}
			if (!content) {
				callback("No content");
				return;
			}

			if (!content.body.match(/problem_solution[&;a-z]+cr=(\d+)[&;=\w]+"/)) {
				callback("No solution");
				return;
			}

			cout("Downloading system test results...");
			var cr = RegExp.$1;
			target_url = problem_solution_url + '&cr=' + cr + '&rd=' + round_id + '&pm=' + problem_id;
			download.get(target_url, null, function(err, content) {
				if (err) {
					callback(err);
					return;
				}
				if (!content) {
					callback("No content");
					return;
				}

				var c = content.body.split('</TR>').filter(function(element, index, array) {
					return element.match(/>Passed</);
				});
				if (c.length <= 0) {
					callback("No content");
					return;
				}

				c = c.map(function(val) {
					var a = val.split('</TD>').filter(function(element, index, array) {
						return element.match(/statText/);
					}).map(function(val) {
						return val.replace(/^[\n\s]+<TD.*">/, '');
					});
					var arg = a[0].split(',\n');
					return [a[1], arg];
				});
				fs.writeFile(filename, array_to_json(c));
				callback();
			});
		});
	});
}

function get(req, res) {
	var params = req.method == "POST" ? req.body : req.query;
	var round_id = parseInt(params['round']);
	var problem_id = parseInt(params['problem']);

	if (!round_id || !problem_id) {
		var error_message = "Invalid args";
		res.json({statusCode:0, error_message:error_message});
		return;
	}
	if (!srm_problems.hasOwnProperty(round_id)) {
		var error_message = "Invalid round id";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	var round = srm_problems[round_id];
	var problem = null;
	for (var i = 0; i < round.length; ++i) {
		if (round[i]['pm'] == problem_id) {
			problem = round[i];
			break;
		}
	}
	if (!problem) {
		var error_message = "Invalid problem id";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	var path = (config['code_gen_path'] + '/' + problem.path + '/').replace('//', '/');
	download.mkdir(path);
	var class_name = problem['cn'];
	path += class_name;
	cout("round", round_id, "problem", problem, "path", path);

	async.waterfall([
		function(next) {
			download_srm_problem_statement(round_id, problem_id, path, next);
		},
		function(statement, next) {
			generate_code(path, statement, next);
		},
		function(next) {
			var filename = path + ext();
			setTimeout(function() { watcher.watch(filename); }, 100);

			download_srm_system_test_results(round_id, problem_id, path, next);
		},
	], function(err, result) {
		res.json({statusCode:0});
	});
}

function run(req, res) {
	var params = req.method == "POST" ? req.body : req.query;
	var round_id = parseInt(params['round']);
	var problem_id = parseInt(params['problem']);

	if (!round_id || !problem_id) {
		var error_message = "Invalid args";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	if (!srm_problems.hasOwnProperty(round_id)) {
		var error_message = "Invalid round id";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	var round = srm_problems[round_id];
	var problem = null;
	for (var i = 0; i < round.length; ++i) {
		if (round[i]['pm'] == problem_id) {
			problem = round[i];
			break;
		}
	}
	if (!problem) {
		var error_message = "Invalid problem id";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	var path = (config['code_gen_path'] + '/' + problem.path + '/').replace('//', '/');
	var filename = path + problem.cn + test_argst_ext;
	fs.readFile(filename, 'utf8', function(err, data) {
		if (err) {
			var error_message = "Test case not found";
			res.json({statusCode:0, error_message:error_message});
			return;
		}

		var exe = filename.replace(test_argst_ext, '');
		var json = JSON.parse(data);
		invoke(exe, json);
		res.json({statusCode:1, total:json.length});
	});
}

module.exports = function(options) {
	app = options.app;
	config = options.config;
	download = require('./download')({app:app, config:config});
	watcher = options.watcher;
	return {
		ext:ext,
		get:get,
		run:run,
		update_list:update_list,
	};
}

