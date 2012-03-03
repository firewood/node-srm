
// するめ

var xhr;

function console_log(msg) {
	if (typeof console != 'undefined') {
	    console.log(msg);
	}
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

function on_click_problem(round, problem) {


	cout("round", round, "problem", problem);


	ajax('/getProblem?round=' + round + '&problem=' + problem, function(err, response) {
		if (err) {
			$('#problems').html(err);
		} else {
			try {
				div = banner + '<div>' + gen_problems_table(id, response.body) + '</div>';
				$('#problems').html(div);
			} catch (e) {

			}
		}
	});
}

function gen_problems_table(round, data) {
	var levels = [
		'Division I Level One (Easy)',
		'Division I Level Two (Medium)',
		'Division I Level Three (Hard)',
		'Division II Level One (Easy)',
		'Division II Level Two (Medium)',
		'Division II Level Three (Hard)',
	];
	var div = '<table>';
	for (var i = 0; i < data.length; ++i) {
		div += '<tr>';
		div += '<td>' + levels[i] + '</td>';
		div += '<td><a href="javascript:on_click_problem(' + round + ', ' + data[i].pm + ')">' + data[i].title + '</a></td>';
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
			$('#problems').html(err);
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
					on_click_round(id, caption);
				});
			} catch (e) {

			}
		}
	});
});

