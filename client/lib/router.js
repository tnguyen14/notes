var Navigo = require('navigo');
var router = new Navigo(process.env.CLIENT_URL);
var note = require('./note');
var list = require('../components/list');

module.exports = router;
module.exports.route = function () {
	router.on(routes).resolve();
	router.updatePageLinks();
};

let routes = {
	'/:id': function (params) {
		var noteId = params.id;
		if (noteId[noteId.length - 1] === '#') {
			// remove ending hash
			// see https://github.com/krasimir/navigo/issues/61
			noteId = noteId.slice(0, -1);
		}
		if (!noteId) {
			return;
		}
		var n = note.findNoteById(noteId) ||
			note.findNoteByName(noteId);
		// try to find by Name
		if (!n) {
			// if no note found, replaceState to /
			router.pause(true);
			router.navigate('/');
			router.pause(false);
			return;
		}
		if (n) {
			note.setActiveNote('drive', n);
			list.setActiveNote(n.id);
		}
	}
};

