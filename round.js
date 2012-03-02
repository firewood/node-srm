
var cout = console.out;

var url = require('url');
var http = require('http');
var https = require('https');
var fs = require('fs');
var querystring = require('querystring');
var xml = require('./xml');

var top_url = 'https://community.topcoder.com/tc';
var round_list_url = 'http://community.topcoder.com/tc?module=BasicData&c=dd_round_list';
var round_overview_url = 'https://community.topcoder.com/stat?c=round_overview&er=0&rd=';
var round_list_filename = 'public/all_rounds.json';
var srm_round_list_filename = 'public/srm_rounds.json';
var srm_problem_list_filename = 'public/srm_problems.json';
var download_retries = 3;
var srm_problems = {};

var app;
var config;
var cookie;

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
		if (round_name.match(/SRM ([0-9.]+)/)) {
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
				fs.writeFile(round_list_filename, JSON.stringify(list), function (err) { });
				list = set_srm_round_list(list);
				fs.writeFile(srm_round_list_filename, JSON.stringify(list), function (err) { });

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
				list = JSON.parse(content);
				cout("number of SRM rounds: " + list.length);
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

function get(req, res) {
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
				fs.writeFile(srm_problem_list_filename, JSON.stringify(srm_problems), function (err) { });
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

	app.get('/getRound', get);
}

