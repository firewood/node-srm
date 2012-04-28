
var cout = console.out;

var fs = require('fs');
var xml = require('./xml');

var round_list_url = 'http://community.topcoder.com/tc?module=BasicData&c=dd_round_list';
var round_overview_url = 'http://community.topcoder.com/stat?c=round_overview&er=0&rd=';
var round_list_filename = 'public/all_rounds.json';
var srm_round_list_filename = 'public/srm_rounds.json';
var srm_problem_list_filename = 'public/srm_problems.json';

var app;
var config;
var problem;
var download;
var srm_rounds = [];
var srm_problems = {};

function json_stringify(a) {
	var j = JSON.stringify(a);
	return j.split('},{').join('},\n{');
}

function convert_round_nodes(nodes) {
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

function extract_srm_round_list(list) {
	var srm_rounds = [];
	for (var i = 0; i < list.length; ++i) {
		var round_name = list[i]['short_name'];
		var round_id = list[i]['round_id'];
		var path = round_id;
		if (!round_name.match(/College Tour/) && round_name.match(/SRM\s+([\.\d]+)/i)) {
			path = 'srm_' + RegExp.$1;
			path = path.replace('.', '_');
			srm_rounds.push({id:round_id, name:round_name, path:path});
		}
	}
	return srm_rounds;
}

function parse_round_xml(data, callback) {
	cout("Converting round list xml...");
	xml.xml2json(data, function(err, nodes) {
		var list = null;
		if (!err) {
			list = convert_round_nodes(nodes);
			if (!list) {
				err = "Empty round list";
			} else {
				fs.writeFile(round_list_filename, json_stringify(list));
				list = extract_srm_round_list(list);
				srm_rounds = list;
				fs.writeFile(srm_round_list_filename, json_stringify(list));
				cout("Number of SRM rounds: " + list.length);
			}
		}
		if (err) {
			cout(err);
		}
		if (callback) {
			callback(err, list);
		}
	});
}

function download_srm_problem_id(round_id, callback) {
	var path = round_id;
	for (var i = 0; i < srm_rounds.length; ++i) {
		if (srm_rounds[i]['id'] == round_id) {
			path = srm_rounds[i]['path'];
		}
	}

	var target_url = round_overview_url + round_id;
	download.get(target_url, null, function(err, content) {
		var problems = null;
		if (!err) {
			problems = [];
			content.body.match(/a href="[^"]+[^>]+[^<]+/ig).map(function(val) {
				if (val.match(/problem_statement.*pm=(\d+).*>(.*)/)) {
					var pm = RegExp.$1;
					var class_name = RegExp.$2;
					problems.push({pm:pm, cn:class_name, path:path});
				}
			});
		}
		if (callback) {
			callback(err, problems);
		}
	});
}

function init() {
	download.load(srm_round_list_filename, round_list_url, null, parse_round_xml, null);
	fs.readFile(srm_problem_list_filename, 'utf8', function(err, content) {
		if (!err) {
			try {
				srm_problems = JSON.parse(content);
				problem.update_list(srm_problems);
			} catch (e) {

			}
		}
	});
}

function get(req, res) {
	var params = req.method == "POST" ? req.body : req.query;
	var round_id = parseInt(params['round']);
	if (!round_id) {
		var error_message = "Invalid args";
		res.json({statusCode:0, error_message:error_message});
		return;
	}

	if (srm_problems.hasOwnProperty(round_id)) {
//		cout("cached", srm_problems[round_id]);
		res.json({statusCode:1, body:srm_problems[round_id]});
		return;
	}

	download_srm_problem_id(round_id, function(err, problems) {
		if (!err && problems) {
			cout("updating problem list...");
			srm_problems[round_id] = problems;
			problem.update_list(srm_problems);
			fs.writeFile(srm_problem_list_filename, json_stringify(srm_problems));
			res.json({statusCode:1, body:srm_problems[round_id]});
		} else {
			var error_message = err.toString();
			if (!err) {
				error_message = "No content";
			}
			res.json({statusCode:0, error_message:error_message});
		}
	});
}

function run(req, res) {
	problem.run(req, res);
}

module.exports = function(options) {
	app = options.app;
	config = options.config;
	problem = options.problem;
	download = require('./download')({app:app, config:config});
	return {
		init:init,
		get:get,
		run:run,
	};
}

