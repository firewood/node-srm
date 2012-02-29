
var cout = console.out;

var url = require('url');
var http = require('http');
var fs = require('fs');
var xml = require('./xml');

var round_list_url = 'http://community.topcoder.com/tc?module=BasicData&c=dd_round_list';
var round_list_filename = 'public/all_rounds.json';
var srm_round_list_filename = 'public/srm_rounds.json';

exports.round_list = null;

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
	exports.round_list = srm_rounds;
	return srm_rounds;
}

exports.download = function(callback) {
	var content = '';
	var req = http.get(url.parse(round_list_url), function(res) {
		res.setEncoding('utf-8');
		res.on('data', function(chunk) {
			content += chunk;
		});
		res.on('end', function() {
			xml.xml2json(content, function(err, nodes) {
				var list = null;
				if (!err) {
					list = convert_round_list(nodes);
					fs.writeFile(round_list_filename, JSON.stringify(list), function (err) {
					});
					list = set_srm_round_list(list);
					fs.writeFile(srm_round_list_filename, JSON.stringify(list), function (err) {
					});
				}
				callback(err, list);
			});
		});
	});
};

exports.initialize = function(callback) {
	fs.readFile(round_list_filename, 'utf8', function(err, content) {
		var list = null;
		if (err) {
			exports.download(callback);
		} else {
			list = JSON.parse(content);
			list = set_srm_round_list(list);
			callback(null, list);
		}
	});
};

