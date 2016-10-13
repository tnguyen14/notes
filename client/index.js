var note = require('./note');
var editor = require('./editor');
var menu = require('./menu');
var signin = require('./signin');

menu.startListening();
editor.startListening();

signin.getProfile()
	.then(note.getNotes)
	.then(function () {
		console.log('Done!');
	}, function (err) {
		console.error(err);
	});
