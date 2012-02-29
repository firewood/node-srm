
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

function gen_combobox(data) {
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
	xhr = $.ajax({
		error: function(_xhr, status, error) {
			xhr = null;
			$('#rounds').html('');
		},
		success: function(data) {
			xhr = null;
			$('#rounds').html(gen_combobox(data));
			$('#rounds').bind('change', function(event) {
				var selected = event.target.options[event.target.selectedIndex];
				var text = selected.text;
				var id = selected.value;

			});
		},
		type: "GET",
		url: 'srm_rounds.json',
		dataType: "json",
	});
});

