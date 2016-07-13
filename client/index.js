var queryString = require('query-string');
var qs = queryString.parse(window.location.search);

var drive = require('./drive');
var local = require('./local');
var editor = require('./editor');
var add = require('./add');

add.startListening();
editor.startListening();

local.getNotes().then(function () {
	if (qs.code) {
		return drive.submitDriveAuth(qs.code);
	}
	return drive.getDriveNotes();
});

