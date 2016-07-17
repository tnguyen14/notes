var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var note = require('./note');
var editor = require('./editor');
var notify = require('./notify');

var endPoint = '/api/local';
var TYPE = 'local';
var list = document.querySelector('.list.local ul');
var notes;

function getNotes () {
	return getJson(endPoint).then(function (response) {
		notes = response.notes.map(function (n) {
			n.type = TYPE;
			return n;
		});
		note.renderNotes({
			notes: notes,
			label: response.label,
			type: TYPE,
			addHandler: newNote
		});
	});
}

function newNote () {
	var n = {
		id: 'Untitled/index.md',
		name: 'Untitled',
		content: '',
		type: 'local',
		new: true
	};
	notes.push(n);
	note.addNote(TYPE, n);
	note.showNote(n);
	editor.writeMode();
	return n;
}

function saveNote (n) {
	var note = notes.find(function (_n) {
		return _n.id === n.id;
	});
	if (!note) {
		return;
	}
	if (n.content === note.content && n.title === note.name) {
		notify({
			type: 'blue',
			message: 'No new change detected.'
		});
		return;
	}
	var updated = {};
	var url = endPoint;
	var method = postJson;
	if (n.content !== note.content) {
		updated.content = n.content;
	}
	if (!note.new) {
		url += '/' + encodeURIComponent(note.id);
		method = putJson;
		if (n.name !== note.name) {
			updated.name = n.name;
		}
	} else {
		updated.name = n.name;
	}
	method(url, updated).then(function (resp) {
		if (note.new) {
			delete note.new;
		}
		if (updated.name) {
			note.name = updated.name;
			note.id = updated.name + '/index.md';
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

function removeNote (id) {
	if (!id) {
		return;
	}
	var noteIndex = notes.find(function (_n) {
		return _n.id === id;
	});
	if (noteIndex === -1) {
		return;
	}
	var note = notes[noteIndex];
	deleteJson(endPoint + '/' + encodeURIComponent(note.id))
		.then(function () {
			var li = list.querySelector('[data-id=' + note.id + ']');
			li.parentNode.removeChild(li);
			notes.splice(noteIndex, 1);
			editor.setNote();
		});
}

editor.registerHandler({
	event: 'save',
	type: 'local',
	handler: saveNote
});
editor.registerHandler({
	event: 'remove',
	type: 'local',
	handler: removeNote
});

module.exports = {
	getNotes: getNotes,
	newNote: newNote,
	saveNote: saveNote,
	removeNote: removeNote
};
