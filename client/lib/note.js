var Promise = require('bluebird');
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var config = require('../components/config');
var editor = require('../components/editor');
var list = require('../components/list');
var menu = require('../components/menu');
var notify = require('./notify');
var user = require('./user');

module.exports = {
	getNotes,
	findNoteById
};

var notes = {
	drive: []
};
var endPoints = {
	drive: process.env.API_URL + '/drive'
};

editor.registerSaveHandler(saveNote);
editor.registerRemoveHandler(removeNote);

function getNotes () {
	return Promise.all([
		getDriveNotes()
	]).then(() => {
		// show the fist drive note
		if (notes.drive.length > 0) {
			let note = notes.drive[0];
			list.setActiveNote(note.id);
			editor.setNote(note);
			editor.viewMode();
		}
	});
}

function getDriveNotes () {
	list.showLoader('drive');
	return getJson(endPoints.drive, {
		credentials: 'include'
	}).then((response) => {
		list.hideLoader('drive');
		notes.drive = response.notes;
		list.registerOnNoteClickHandler(function (note) {
			editor.setNote(note);
			editor.viewMode();
		});
		list.renderNotes('drive', response);
		menu.registerAddNoteHandler({
			label: response.label,
			type: 'drive',
			handler: newNote.bind(window, 'drive')
		});
	}, (err) => {
		if (err.response.status === 401) {
			return user.authorize('https://www.googleapis.com/auth/drive');
		}
		err.response.json().then((error) => {
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
	notes[type].push(note);
	list.renderNote(type, note);
	list.setActiveNote(note.id);
	editor.setNote(note);
	editor.writeMode();
}

function saveNote (type, n) {
	var note = notes[type].find(function (_n) {
		return _n.id === n.id;
	});
	if (!note) {
		throw new Error('Unable to find note ' + n.id);
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
	}).then((resp) => {
		notify({
			message: 'Saved!',
			type: 'green'
		});
		editor.unfreeze();
		if (note.new) {
			delete note.new;
		}
		if (updated.name) {
			list.updateNoteName(note.id, updated.name, resp.id);
			note.name = updated.name;
			note.id = resp.id;
			editor.setId(resp.id);
		}
		note.content = updated.content;
		editor.viewMode();
		notify({
			message: 'Saved!',
			type: 'green',
			timeout: 3000
		});
	}, (err) => {
		if (err.response.status === 401) {
			// @TODO store localStorage
			user.authorize('https://www.googleapis.com/auth/drive');
			return;
		}
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
	deleteJson(endPoints[type] + '/' + encodeURIComponent(note.id), {
		credentials: 'include'
	})
		.then(function () {
			list.removeNote(note.id);
			notes[type].splice(noteIndex, 1);
			notify({
				message: 'Successfully deleted note.',
				type: 'green',
				timeout: 3000
			});
			// show the next note
			var nextNote = notes[type][0];
			list.setActiveNote(nextNote.id);
			editor.setNote(nextNote);
			editor.viewMode();
		});
}

function findNoteById (id) {
	// only search drive notes for now
	var driveResult = notes.drive.find((note) => {
		return note.id === id;
	});
	return driveResult;
}
