
var cout = console.out;

var fs = require('fs'),
	url = require('url'),
	http = require('http'),
	https = require('https'),
	querystring = require('querystring'),
	async = require('async');

var download_retries = 3;
var top_url = 'https://community.topcoder.com/tc';

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

function try_download(count, target_url, post_data, callback) {
	if (count <= 0) {
		if (callback) {
			callback("Download failed", null);
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
//		res.setEncoding('utf-8');
		res.setEncoding('binary');
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
	req.on('error', function(res) {
		if (callback) {
			callback("Download failed", null);
		}
	});
	if (post_data) {
		req.write(post_data);
	}
	req.end();
}

function download(target_url, post_data, callback) {
	try_download(download_retries, target_url, post_data, callback);
}

function load(filename, target_url, post_data, converter, callback) {
	var result;
	async.waterfall([
		function(next) {
			fs.readFile(filename, 'utf8', function(err, content) {
				if (!err) {
					result = content;
					next("OK");
				} else {
					next(null);
				}
			});
		},
		function(next) {
			download(target_url, post_data, next);
		},
		function(content, next) {
			if (content.statusCode != 200) {
				err = "Download failed (" + content.statusCode + ")";
				next(err);
			} else {
				if (converter) {
					converter(content.body, next);
				} else {
					next(null, content.body);
				}
			}
		}
	], function(err, content) {
		if (!err) {
			result = content;
		}
		if (callback) {
			callback(result ? null : err, result);
		}
	});
}

module.exports = function(options) {
	app = options.app;
	config = options.config;
	return {
		mkdir:mkdir,
		load:load,
	};
}

