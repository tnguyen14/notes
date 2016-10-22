var Promise = require('bluebird');
var localforage = require('localforage');
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

const localForageSeparator = '!';

module.exports = {
	getNotes,
	findNoteById
};

localforage.config({
	name: 'inspiredNotes'
});

var notes = {
	drive: []
};

window.notes = notes;

var endPoints = {
	drive: process.env.API_URL + '/drive'
};

// event handlers registration
editor.registerSaveHandler(saveNote);
editor.registerRemoveHandler(removeNote);
list.registerOnNoteClickHandler(setActiveNote);

function getNotes (profile) {
	let type = 'drive';
	getJson(endPoints[type] + '/me', {  // get config
		credentials: 'include'
	}).then((config) => {
		list.renderLabel(type, config.label);
		menu.registerAddNoteHandler({
			label: config.label,
			type,
			handler: newNote.bind(window, type)
		});
	});
	return Promise.all([
		getDriveNotes(),
		getLocalNotes(type, profile.id).then((localNotes) => {
			// eagerly render localNotes first
			notes[type] = localNotes;
			list.renderNotes(type, localNotes);
			return localNotes;
		})
	]).then((res) => {
		// res: [driveNotes, localNotes]
		notes[type] = res[0].map((note) => {
			let localNote = res[1].find((n) => n.id === note.id);
			if (!localNote) {
				// if local note has not exist, store it and render it
				localforage.setItem(getLocalNoteKey(type, profile.id, note.id),
					note);
				list.renderNote(type, note);
			} else if (localNote.name !== note.name ||
				localNote.content !== note.content) {
				// if 2 versions differ
				// @TODO alert user, allow resolution?
				// for now, just store the latest version
				localforage.setItem(getLocalNoteKey(type, profile.id, note.id),
					note);
				list.updateNoteName(note.id, note.name);
			}
			return note;
		});
		// show the fist drive note
		if (notes[type].length > 0) {
			let note = notes[type][0];
			setActiveNote(type, note);
		}
	});
}

function getDriveNotes () {
	list.showLoader('drive');
	return getJson(endPoints.drive, {
		credentials: 'include'
	}).then((response) => {
		list.hideLoader('drive');
		return response.notes;
	}, (err) => {
		list.hideLoader('drive');
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
	setActiveNote(type, note, true);
}

function setActiveNote (type, note, writeMode) {
	list.setActiveNote(note.id);
	editor.setNote(note);
	if (writeMode) {
		editor.writeMode();
	} else {
		editor.viewMode();
	}
	// reset previous active note
	let prevActive = notes[type].find((n) => n.active);
	if (prevActive) {
		prevActive.active = false;
	}
	note.active = true;
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
			setActiveNote(type, nextNote);
		});
}

function findNoteById (id) {
	// only search drive notes for now
	var driveResult = notes.drive.find((note) => {
		return note.id === id;
	});
	return driveResult;
}

function getLocalNoteKey (type, profileId, noteId) {
	return ['note', type, profileId, noteId].join(localForageSeparator);
}

function getLocalNotes (type, userId) {
	var notes = [];
	return localforage.iterate((value, key) => {
		// filter out note with the right type and userId
		if (key.indexOf('note!' + type + '!' + userId) !== 0) {
			return;
		}
		notes.push(value);
	}).then(() => {
		return notes;
	});
}
