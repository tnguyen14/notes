var Promise = require('bluebird');
var drive = require('./drive');
var local = require('./local');
var editor = require('./editor');
var add = require('./add');
var signin = require('./signin');

add.startListening();
editor.startListening();

signin.getProfile().then(function () {
	return Promise.all([
		local.getNotes(),
		drive.getNotes()
	]);
}).then(function () {
	console.log('Done!');
}, function (err) {
	console.error(err);
});
