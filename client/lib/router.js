var Navigo = require('navigo');
var router = new Navigo();
var note = require('./note');

module.exports = router;
module.exports.route = function () {
	router.on(routes).resolve();
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
			return;
		}
		if (n) {
			note.setActiveNote('drive', n);
		}
	}
};

