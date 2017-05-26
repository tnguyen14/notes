var Navigo = require('navigo');
var router = new Navigo(process.env.CLIENT_URL);
var note = require('./note');

module.exports = router;
module.exports.route = function () {
	router.on(routes).resolve();
	router.updatePageLinks();
};

note.on('note:create', (n) => {
	if (!n) {
		return;
	}
	router.updatePageLinks();
	router.navigate('/' + encodeURIComponent(n.name));
});

note.on('note:activate', (n) => {
	if (!n) {
		return;
	}
	router.navigate('/' + encodeURIComponent(n.name));
});

let routes = {
	'/:id': function (params) {
		var noteId = decodeURIComponent(params.id);
		if (!noteId) {
			return;
		}
		var n = note.findNoteById(noteId) ||
			note.findNoteByName(noteId);
		// try to find by Name
		if (!n) {
			// if no note found, pushState to /
			router.navigate('/');
			return;
		}
		if (n) {
			note.setActiveNote(n);
		}
	},
	// wild card is necessary so that '/' route is matched, thus stored as
	// _lastRouteResolved
	'*': function () {
		// if no note is declared, show the first note
		var firstNote = note.findNoteById();
		if (firstNote) {
			router.navigate('/' + encodeURIComponent(firstNote.name));
		}
	}
};

