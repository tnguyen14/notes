var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var note = require('./note');
var editor = require('./editor');
var notify = require('./notify');

var endPoint = '/api/local';
var list = document.querySelector('.list .local ul');
var notes;

function getNotes () {
	return getJson(endPoint).then(function (response) {
		notes = response.notes;
		notes.forEach(function (n, index) {
			var li = note.createNoteLi(n);
			list.parentNode.querySelector('h3').innerHTML = response.label;
			list.appendChild(li);
			if (index === 0) {
				note.showNote(li, n);
			}
		});
		return notes;
	});
}

function saveNote () {
	var active = list.querySelector('.selected');
	var path = active.getAttribute('data-path');
	var note = notes.filter(function (n) {
		return n.path === path;
	})[0];
	var content = editor.getContent();
	var name = editor.getTitle();
	if (editor.isNew()) {
		note.content = content;
		note.name = name;
	}
	if (content === note.content && name === note.name) {
		notify({
			type: 'blue',
			message: 'No new change detected.'
		});
		return;
	}
	var updated = {};
	var url = endPoint;
	var method = postJson;
	if (content !== note.content) {
		updated.content = content;
	}
	if (!editor.isNew()) {
		url += '/' + encodeURIComponent(note.path);
		method = putJson;
		if (name !== note.name) {
			updated.name = name;
		}
	} else {
		updated.name = name;
	}
	method(url, updated).then(function (resp) {
		if (editor.isNew()) {
			editor.setNew(false);
			note.path = updated.name + '/index.md';
			notes.push(note);
		}
		if (updated.name) {
			note.name = updated.name;
			note.path = updated.name + '/index.md';
		}
		note.content = updated.content;
		editor.viewMode();
		notify({
			message: 'Saved!',
			type: 'green',
			timeout: 3000
		});
	}, function (err) {
		notify({
			message: err,
			type: 'red'
		});
	});
}

function removeNote () {
	// @TODO update selector below by using some sort of ID from the editor
	var active = document.querySelector('.list ul .selected');
	if (!active) {
		return;
	}
	var path = active.getAttribute('data-path');
	deleteJson(endPoint + '/' + encodeURIComponent(path))
		.then(function () {
			// @TODO this should be rewritten to completely remove note
			// and update DOM elements
			list.querySelector('[data-path=' + path + ']').style.display = 'none';
			editor.updateTitle();
			editor.updateContent();
		});
}

module.exports = {
	getNotes: getNotes,
	saveNote: saveNote,
	removeNote: removeNote
};
