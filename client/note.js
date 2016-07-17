var simpleFetch = require('simple-fetch');
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var editor = require('./editor');
var add = require('./add');
var notify = require('./notify');

var notes = {
	local: [],
	drive: []
};
var lists = {};
var endPoints = {
	local: '/api/local',
	drive: ''
};
var listsContainer = document.querySelector('.lists');
window.notes = notes;

editor.registerSaveHandler(saveNote);
editor.registerRemoveHandler(removeNote);

function addNote (type, note) {
	var li = document.createElement('li');
	note.type = type;
	li.innerHTML = note.name;
	li.classList.add('list-item');
	li.setAttribute('data-id', note.id);
	li.addEventListener('click', showNote.bind(window, note));
	lists[type].appendChild(li);
	notes[type].push(note);
}

function renderNotes (opts) {
	var list = lists[opts.type] = listsContainer.querySelector('.list.' + opts.type + ' ul');
	list.parentNode.querySelector('h3').innerHTML = opts.label;
	opts.notes.forEach(addNote.bind(window, opts.type));
	add.registerHandler({
		label: opts.label,
		type: opts.type,
		handler: newNote.bind(window, opts.type)
	});
}

function newNote (type) {
	var note = {
		id: 'Untitled/index.md',
		name: 'Untitled',
		content: '',
		type: type,
		new: true
	};
	addNote(type, note);
	showNote(note);
	editor.writeMode();
}

function saveNote (type, n) {
	var note = notes[type].find(function (_n) {
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
	// request body object
	var updated = {};
	var url = endPoints[type];
	var method = postJson;
	if (n.content !== note.content) {
		updated.content = n.content;
	}
	if (note.new) {
		updated.name = n.title;
	} else {
		url += '/' + encodeURIComponent(note.id);
		method = putJson;
		if (n.title !== note.name) {
			updated.name = n.title;
		}
	}
	method(url, updated).then(function (resp) {
		if (note.new) {
			delete note.new;
		}
		if (updated.name) {
			let li = listsContainer.querySelector('[data-id="' + note.id + '"]');
			li.innerHTML = updated.name;
			note.name = updated.name;
			note.id = resp.id;
			li.setAttribute('data-id', resp.id);
			editor.setId(resp.id);
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

function removeNote (type, id) {
	if (!id) {
		return;
	}
	var noteIndex = notes[type].findIndex(function (_n) {
		return _n.id === id;
	});
	if (noteIndex === -1) {
		return;
	}
	var note = notes[type][noteIndex];
	deleteJson(endPoints[type] + '/' + encodeURIComponent(note.id))
		.then(function () {
			var li = lists[type].querySelector('[data-id="' + note.id + '"]');
			li.parentNode.removeChild(li);
			notes[type].splice(noteIndex, 1);
			editor.setNote();
		});
}

function showNote (note) {
	var li = listsContainer.querySelector('[data-id="' + note.id + '"]');
	if (!li) {
		return;
	}
	Array.prototype.forEach.call(listsContainer.querySelectorAll('.lists .list-item'), function (l) {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
	editor.setNote(note);
	editor.viewMode();
}

module.exports = {
	addNote: addNote,
	renderNotes: renderNotes,
	showNote: showNote
};
