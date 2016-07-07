var queryString = require('query-string');
var qs = queryString.parse(window.location.search);

var drive = require('./drive');
var local = require('./local');
var note = require('./note');
var editor = require('./editor');

var deleteConfirm = document.querySelector('dialog.delete-confirm');

// https://github.com/benjamingr/RegExp.escape
if (!RegExp.escape) {
	RegExp.escape = function (s) {
		return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	};
}

Array.prototype.forEach.call(document.querySelectorAll('.tabnav button'), function (button) {
	button.addEventListener('click', function (e) {
		if (editor.isWriting()) {
			editor.viewMode();
		} else {
			editor.writeMode();
		}
	});
});

document.querySelector('.save').addEventListener('click', local.saveNote);
document.querySelector('.add').addEventListener('click', function () {
	var list = document.querySelectorAll('.list section')[0].querySelector('ul');
	var n = {
		path: 'Untitled/index.md',
		name: 'Untitled',
		content: ''
	};
	var li = note.createNoteLi(note);
	list.appendChild(li);
	note.showNote(li, n);
	editor.writeMode();
	editor.setNew(true);
});

document.querySelector('.remove').addEventListener('click', function () {
	deleteConfirm.showModal();
});
deleteConfirm.querySelector('.confirm').addEventListener('click', function () {
	deleteConfirm.close();
	local.removeNote();
});
deleteConfirm.querySelector('.cancel').addEventListener('click', function () {
	deleteConfirm.close();
});

local.getNotes().then(function () {
	if (qs.code) {
		return drive.submitDriveAuth(qs.code);
	}
	return drive.getDriveNotes();
});

