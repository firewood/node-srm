
var cout = console.out;

var url = require('url');
var http = require('http');
var https = require('https');
var fs = require('fs');
var os = require('os');
var exec = require('child_process').exec;
var querystring = require('querystring');
var xml = require('./xml');

var top_url = 'https://community.topcoder.com/tc';
var round_list_url = 'http://community.topcoder.com/tc?module=BasicData&c=dd_round_list';
var round_overview_url = 'http://community.topcoder.com/stat?c=round_overview&er=0&rd=';
var problem_url = 'http://community.topcoder.com/stat?c=problem_statement';
var round_list_filename = 'public/all_rounds.json';
var srm_round_list_filename = 'public/srm_rounds.json';
var srm_problem_list_filename = 'public/srm_problems.json';
var srm_base_path = 'public/srm/';
var statement_ext = '.html';
var download_retries = 3;
var srm_rounds = [];
var srm_problems = {};

var app;
var config;
var cookie;

function mkdir(path) {
	var a = path.split('/');
	var p = '';
	for (var i = 0; i < a.length; ++i) {
		if (a[i]) {
			p += a[i] + '/';
			try {
				fs.mkdirSync(p);
			} catch (e) {
			}
		}
	}
}

function srm_problem_path(round, problem) {
	var round_path = round;
	for (var i = 0; i < srm_rounds.length; ++i) {
		if (srm_rounds[i]['id'] == round) {

			cout("found", srm_rounds[i]);

			var caption = srm_rounds[i]['name'];
			if (caption.match(/srm\s+(\d+)/i)) {
				round_path = 'srm_' + RegExp.$1;
				break;
			}
		}
	}
	return srm_base_path + round_path + '/';
}

function url_strip_path(u) {
	return u.substr(0, u.indexOf('/', 8));
}

function try_download(count, target_url, post_data, callback) {
	if (count <= 0) {
		if (callback) {
			callback(1, null);
		}
		return;
	}

	var _target_url = target_url;
	var _post_data = post_data;

	if (!cookie) {
		// login if we have no cookies
		cout("logging in...");
		target_url = top_url;
		post_data = {
			module: 'Login',
			nextpage: _target_url,
			username: config.username,
			password: config.password
		};
	}

	var options = url.parse(target_url);
	options.headers = {};
	if (post_data) {
		post_data = querystring.stringify(post_data);
		options.method = 'POST';
		options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		options.headers['Content-Length'] = post_data.length;
	}
	if (cookie) {
		options.headers['Cookie'] = cookie;
		cout("using cookie", cookie);
	}

	var protocol = http;
	if (options.protocol == 'https:') {
		protocol = https;
	}
	var content = '';
	var req = protocol.request(options, function(res) {
		res.setEncoding('utf-8');
		if (res.headers['set-cookie']) {
			cookie = res.headers['set-cookie'];
			cout("set cookie", cookie);
		}
		res.on('data', function(chunk) {
			content += chunk;
		});
		res.on('end', function() {
			var err = null;
			if (res.statusCode >= 300 && res.statusCode <= 399) {
				cout(res.statusCode, "new location", res.headers['location']);
				try_download(count - 1, res.headers['location'], _post_data, callback);
			} else if (callback) {
				callback(err, {
					statusCode:res.statusCode,
					headers:res.headers,
					body:content
				});
			}
		});
	});
	if (post_data) {
		req.write(post_data);
	}
	req.end();
}

function download(target_url, post_data, callback) {
	try_download(download_retries, target_url, post_data, callback);
}

function convert_round_list(nodes) {
	var rounds = [];
	if (!nodes.hasOwnProperty('c')) {
		return null;
	}
	var dd = nodes['c'][0];
	if (!dd.hasOwnProperty('c')) {
		return null;
	}
	var rows = dd['c'];
	for (var i = 0; i < rows.length; ++i) {
		if (!rows[i].hasOwnProperty('c')) {
			continue;
		}
		var c = rows[i]['c'];
		var round = {};
		for (var j = 0; j < c.length; ++j) {
			round[c[j]['n']] = c[j]['t'];
		}
		if (round.hasOwnProperty('round_id')) {
			rounds.push(round);
		}
	}
	return rounds;
}

function set_srm_round_list(list) {
	var srm_rounds = [];
	for (var i = 0; i < list.length; ++i) {
		var round_name = list[i]['short_name'];
		if (!round_name.match(/College Tour/) && round_name.match(/SRM ([0-9.]+)/)) {
			srm_rounds.push({id:list[i]['round_id'], name:round_name});
		}
	}
	return srm_rounds;
}

function download_round_list(callback) {
	cout("updating round list...");
	download(round_list_url, null, function(err, content) {
//	login(round_list_url, function(err, content) {
		if (err || content.statusCode != 200) {
			return;
		}

		xml.xml2json(content.body, function(err, nodes) {
			var list = null;
			if (!err) {
				list = convert_round_list(nodes);
				fs.writeFile(round_list_filename, JSON.stringify(list), function(err) { });
				list = set_srm_round_list(list);
				srm_rounds = list;
				fs.writeFile(srm_round_list_filename, JSON.stringify(list), function(err) { });

				cout("number of SRM rounds: " + list.length);
			}
			cout("done");
			if (callback) {
				callback(err, list);
			}
		});
	});
}

function load_round_list(callback) {
	fs.readFile(srm_round_list_filename, 'utf8', function(err, content) {
		if (!err) {
			try {
				srm_rounds = JSON.parse(content);
				cout("number of SRM rounds: " + srm_rounds.length);
				return;
			} catch (e) {

			}
		}
		download_round_list();
	});
}

function load_problem_list(callback) {
	fs.readFile(srm_problem_list_filename, 'utf8', function(err, content) {
		if (!err) {
			try {
				srm_problems = JSON.parse(content);
			} catch (e) {

			}
		}
	});
}

function download_srm_problem_id(round, callback) {
	var target_url = round_overview_url + round;
	download(target_url, null, function(err, content) {
		var problems = null;
		if (!err) {
			problems = [];
			content.body.match(/a href="[^"]+[^>]+[^<]+/ig).map(function(val) {
				if (val.match(/problem_statement.*pm=(\d+).*>(.*)/)) {
					var pm = RegExp.$1;
					var title = RegExp.$2;
					problems.push({pm:pm, title:title});
				}
			});
		}
		if (callback) {
			callback(err, problems);
		}
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

function download_srm_problem_statement(round_id, problem_id, callback) {
	if (!srm_problems.hasOwnProperty(round_id)) {
		callback("invalid round id", null);
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
		callback("invalid problem id", null);
		return;
	}

	var division = i / 3;
	var level = i % 3;

	var path = srm_problem_path(round_id, problem_id);
	mkdir(path);
	var title = problem['title'];
	path += title;

	cout("round", round_id, "problem", problem, "path", path);

	fs.readFile(path + statement_ext, 'utf8', function(err, html) {
		if (!err) {
			callback(null, path);
			return;
		}

		var target_url = problem_url + '&pm=' + problem_id + '&rd=' + round_id;
		cout("url", target_url);

		download(target_url, null, function(err, content) {
			if (!err) {
				var statement = '<html><body>\n' + trim_statement(content.body) + '</body></html>\n';
				fs.writeFile(path + statement_ext, statement, function(err) { });
			}
			callback(err, path);
		});
	});
}

function get_problem(req, res) {
	var params = req.method == "POST" ? req.body : req.query;
	var round_id = parseInt(params['round']);
	var problem_id = parseInt(params['problem']);

	if (!round_id || !problem_id) {
		res.json({statusCode:0});
		return;
	}

	download_srm_problem_statement(round_id, problem_id, function(err, path) {
		if (err) {
//			res.json({statusCode:0});
			res.send(JSON.stringify({statusCode:0}));
		} else {
			var a = path.split('/');
			a.shift();
			path = a.join('/');
//			res.json({statusCode:1, path:path});
			res.send(JSON.stringify({statusCode:1, path:path}));

			if (os.platform() == 'win32') {
				// open folder on Windows
				a.pop();
				path = a.join('\\');
				var child = exec('start ' + path);
			}
		}
	});
}

function get_round(req, res) {
	var params = req.method == "POST" ? req.body : req.query;
	var division = parseInt(params['division']);
	var round = parseInt(params['round']);
	if (!round) {
		res.json({statusCode:0});
		return;
	}

	if (srm_problems.hasOwnProperty(round)) {
		cout("cached", srm_problems[round]);
		res.json({statusCode:1, body:srm_problems[round]});
	} else {
		download_srm_problem_id(round, function(err, problems) {
			if (!err && problems) {
				cout("updating problem list...");
				srm_problems[round] = problems;
				fs.writeFile(srm_problem_list_filename, JSON.stringify(srm_problems), function(err) { });
				res.json({statusCode:1, body:srm_problems[round]});
			} else {
				res.json({statusCode:0});
			}
		});
	}
}

module.exports = function(options) {
	app = options.app;
	config = options.config;
	cookie = '';

	load_round_list(function(err, callback) {
	});
	load_problem_list(function(err, callback) {
	});

	app.get('/getRound', get_round);
	app.get('/getProblem', get_problem);
}

