var Promise = require('bluebird');
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var editor = require('./editor');
var menu = require('./menu');
var loader = require('./lib/loader');
var notify = require('./lib/notify');
var user = require('./lib/user');
var config = require('./config');

module.exports = {
	getNotes: getNotes,
	addNote: addNote
};

var notes = {
	local: [],
	drive: []
};
var lists = {};
var endPoints = {
	local: process.env.API_URL + '/local',
	drive: process.env.API_URL + '/drive'
};
var listsContainer = document.querySelector('.lists');
window.notes = notes;

editor.registerSaveHandler(saveNote);
editor.registerRemoveHandler(removeNote);

function getNotes () {
	return Promise.all([
		// getLocalNotes(),
		getDriveNotes()
	]).then(function () {
		// show the fist drive note
		if (notes.drive.length > 0) {
			showNote(notes.drive[0]);
		}
	});
}

// function getLocalNotes () {
// 	return getJson(endPoints.local).then(function (response) {
// 		renderNotes({
// 			notes: response.notes,
// 			label: response.label,
// 			type: 'local'
// 		});
// 	});
// }

function getDriveNotes () {
	lists.drive = listsContainer.querySelector('.list.drive ul');
	loader.show(lists.drive);
	return getJson(endPoints.drive, {
		credentials: 'include'
	}).then((response) => {
		loader.hide(lists.drive);
		renderNotes({
			notes: response.notes,
			label: response.label,
			type: 'drive'
		});
	}, (err) => {
		if (err.response.status === 401) {
			user.authorize('https://www.googleapis.com/auth/drive');
		} else {
			return err.response.json().then((error) => {
				notify({
					type: 'red',
					message: 'Error in getting Google Drive notes: ' + error.message,
					permanent: true
				});
				if (error.message.startsWith('Configuration:')) {
					config.open(() => {
						notify.clear();
						getDriveNotes();
					});
				}
			});
		}
	});
}

// add note to list
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
	var list = lists[opts.type];
	list.parentNode.querySelector('h3').innerHTML = opts.label;
	opts.notes.forEach(addNote.bind(window, opts.type));
	menu.registerHandler({
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
		notify.info('No new change detected.');
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
	notify({
		message: 'Saving note...',
		type: 'blue',
		permanent: true
	});
	editor.freeze();
	method(url, updated, {
		credentials: 'include'
	}).then(function (resp) {
		notify({
			message: 'Saved!',
			type: 'green'
		});
		editor.unfreeze();
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
	}, notify.error);
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
	deleteJson(endPoints[type] + '/' + encodeURIComponent(note.id), {
		credentials: 'include'
	})
		.then(function () {
			var li = lists[type].querySelector('[data-id="' + note.id + '"]');
			li.parentNode.removeChild(li);
			notes[type].splice(noteIndex, 1);
			editor.setNote();
			notify({
				message: 'Successfully deleted note.',
				type: 'green',
				timeout: 3000
			});
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
