var queryString = require('query-string');
var qs = queryString.parse(window.location.search);

var drive = require('./drive');
var local = require('./local');
var editor = require('./editor');
var add = require('./add');

Array.prototype.forEach.call(document.querySelectorAll('.tabnav button'), function (button) {
	button.addEventListener('click', editor.toggleMode);
});

add.startListening();
editor.startListening();
editor.on('editor:save', function (note) {
	if (note.type === 'local') {
		local.saveNote(note);
	}
});
editor.on('editor:remove', function (note) {
	if (note.type === 'local') {
		local.removeNote(note);
	}
});

local.getNotes().then(function () {
	if (qs.code) {
		return drive.submitDriveAuth(qs.code);
	}
	return drive.getDriveNotes();
});

