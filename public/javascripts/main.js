
// するめ

var xhr;
var socket;
var logs = [];
var log_lines = 20;
var current_round;

var levels = [
	'Division I Level One (Easy)',
	'Division I Level Two (Medium)',
	'Division I Level Three (Hard)',
	'Division II Level One (Easy)',
	'Division II Level Two (Medium)',
	'Division II Level Three (Hard)',
];

function refresh_logs() {
	var h = logs.join('<br />');
	$('#status').html(h);
}

function add_log(msg) {
	if (logs.length >= log_lines) {
		logs.shift();
	}
	logs.push(msg);
	refresh_logs();
}

function console_log(msg) {
	if (typeof console != 'undefined') {
	    console.log(msg);
	}
	add_log(msg);
}

cout = function() {
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
	console_log(msg);
}

function ajax(url, callback) {
	if (xhr) {
		callback("busy", null);
	} else {
		xhr = $.ajax({
			error: function(_xhr, status, error) {
				xhr = null;
				var errmsg = 'ajax error: ' + status;
				callback(errmsg, null);
			},
			success: function(data) {
				xhr = null;
				callback(null, data);
			},
			type: "GET",
			url: url,
			dataType: "json",
		});
	}
}

function toggle_rounds() {
	$("#rounds").slideToggle("normal");
}

function toggle_problems() {
	$("#problems").slideToggle("normal");
}

function systemtest(round_id, problem_id) {
	cout('Running system tests: ' + round_id + ', problem: ' + problem_id);
	ajax('/runSystemTests?round=' + round_id + '&problem=' + problem_id, function(err, response) {
		if (err) {
			cout(err);
		} else {
			try {
				cout('DONE');

			} catch (e) {

			}
		}
	});
}

function start_solving(round_id, index) {
	var div = '<div>' + levels[index] + ', ' + current_round[index].cn + '</div>';
	div += '<div>[ <a href="javascript:systemtest(' + round_id + ', ' + current_round[index].pm + ');">Submit &amp; Run system tests</a> ]</div>';
	$('#solving').html(div);
}

function on_click_problem(round_id, index) {
	toggle_problems();
	var problem_id = current_round[index].pm;
	cout("Fetching round: " + round_id + ", problem: " + problem_id);
	ajax('/getProblem?round=' + round_id + '&problem=' + problem_id, function(err, response) {
		if (err) {
			$('#solving').html('<div>' + err + '</div>');
		} else {
			try {
				cout("Done.");
				start_solving(round_id, index);
			} catch (e) {

			}
		}
	});
}

function gen_problems_table(round_id, data) {
	current_round = data;
	var div = '<table>';
	for (var i = 0; i < data.length; ++i) {
		div += '<tr>';
		div += '<td>' + levels[i] + '</td>';
		div += '<td><a href="javascript:on_click_problem(' + round_id + ', ' + i + ')">' + data[i].cn + '</a></td>';
		div += '</tr>';
	}
	div += '</table>';
	return div;
}

function on_click_round(id, caption) {
	var banner = '<h3>' + caption + '</h3>';
	var div = banner + '<div>Downloading...</div>';
	$('#problems').html(div);
	ajax('/getRound?round=' + id, function(err, response) {
		if (err) {
			$('#problems').html('<div>' + err + '</div>');
		} else {
			try {
				div = banner + '<div>' + gen_problems_table(id, response.body) + '</div>';
				$('#problems').html(div);
			} catch (e) {

			}
		}
	});
}

function gen_rounds_combobox(data) {
	var div = '';
	var s = 16;
	for (var i = 0; i < data.length; i += s) {
		var cbo = '<select class="select_round">';
		var a = data.slice(i, i + s);
		cbo += '<option value="0">' + a[0]['name'] + ' ～</option>';
		for (var j = 0; j < a.length; ++j) {
			cbo += '<option value="' + a[j]['id'] + '">■ ' + a[j]['name'] + '</option>';
		}
		cbo += '</select>';
		div += cbo;
	}
	return div;
}

$(function() {
	ajax('srm_rounds.json', function(err, data) {
		if (err) {
			$('#rounds').html(err);
		} else {
			try {
				$('#rounds').html(gen_rounds_combobox(data));
				$('#rounds').bind('change', function(event) {
					var selected = event.target.options[event.target.selectedIndex];
					var id = selected.value;
					var caption = selected.text.substr(1);
					toggle_rounds();
					on_click_round(id, caption);
				});
			} catch (e) {

			}
		}
	});

	var callback = function(msg) {
		cout('R:' + msg);
	};
	var outcb = function(msg) {
		cout('stdout:' + msg);
	};
	var errcb = function(msg) {
		cout('stderr:' + msg);
	};
	socket = io.connect();
	socket.on('connect', function() {
		cout('CONNECTED');
		socket.on('message', callback);
		socket.on('stdout', outcb);
		socket.on('stderr', errcb);
	});
	socket.on('disconnect', function() {
		cout('DISCONNECTED');
		socket.removeAllListeners('message');
		socket.removeAllListeners('stdout');
		socket.removeAllListeners('stderr');
	});
});

