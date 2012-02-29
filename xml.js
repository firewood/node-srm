
var sax = require('sax');

function Node(name) {
	return {n:name};
}

exports.xml2json = function(xml, callback) {
	var err = null;
	var q = [];
	var node = Node('xml');
	var parser = sax.parser(true);
	parser.onerror = function(e) {
		err = e;
	};
	parser.ondoctype = function(t) {

	};
	parser.onprocessinginstruction = function(pi) {
		node['n'] = pi['name'];
//		node['b'] = pi['body'];
	};
	parser.ontext = function(t) {
		node['t'] = t;
	};
	parser.onopentag = function(n) {
		if (!node.hasOwnProperty('c')) {
			node['c'] = [];
		}
		q.push(node);
		node = Node(n['name']);
	};
	parser.onclosetag = function(n) {
		var child = node;
		node = q.pop();
		node['c'].push(child);
	}
	parser.onattribute = function(attr) {

	};
	parser.write(xml);
	callback(err, node);
};

