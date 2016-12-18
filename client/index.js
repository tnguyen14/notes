var editor = require('./components/editor');
var list = require('./components/list');
var note = require('./lib/note');
var user = require('./lib/user');
var router = require('./lib/router');

function init () {
	editor.startListening();
	list.startListening();

	return user.getProfile()
		.then(list.setProfile)
		.then(note.getNotes)
		.then(function () {
			router.route();
		}, function (err) {
			console.error(err.stack);
		});
}

document.addEventListener('DOMContentLoaded', init);
