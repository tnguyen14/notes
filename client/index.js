var editor = require('./components/editor');
var list = require('./components/list');
var menu = require('./components/menu');
var note = require('./lib/note');
var user = require('./lib/user');
var router = require('./lib/router');

function init () {
	menu.startListening();
	editor.startListening();

	return user.getProfile()
		.then(menu.setProfile)
		.then(note.getNotes)
		.then(function () {
			console.log('Done!');
			router.on({
				'n/:id': function (params) {
					if (params.id) {
						var n = note.findNoteById(params.id);
						if (n) {
							editor.showNote(n);
							editor.viewMode();
							list.setActiveNote(n.id);
						}
					}
				}
			}).resolve();
		}, function (err) {
			console.error(err);
		});
}

window.onload = init;
