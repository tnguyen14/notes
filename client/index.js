var editor = require('./components/editor');
var menu = require('./components/menu');
var list = require('./components/list');
var note = require('./lib/note');
var user = require('./lib/user');
var router = require('./lib/router');

function init () {
	menu.startListening();
	editor.startListening();
	list.startListening();

	return user.getProfile()
		.then(menu.setProfile)
		.then(note.getNotes)
		.then(function () {
			router.route();
		}, function (err) {
			console.error(err.stack);
		});
}

document.addEventListener('DOMContentLoaded', init);
