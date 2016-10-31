var Promise = require('bluebird');
var localforage = require('localforage');
var moment = require('moment');
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
		notes[type] = res[0].map((driveNote) => {
			let localNote = res[1].find((n) => n.id === driveNote.id);
			if (!localNote) {
				// if local note has not exist, store it and render it
				localforage.setItem(getLocalNoteKey(type, profile.id, driveNote.id),
					driveNote);
				list.renderNote(type, driveNote);
			} else if (localNote.name !== driveNote.name ||
				localNote.content !== driveNote.content) {
				// if 2 versions differ
				// if local version is newer than remote version,
				// store drive version as old note, use local version
				if (moment(driveNote.modifiedTime).isBefore(localNote.modifiedTime)) {
					console.log('dirty!');
					localNote.oldNote = driveNote;
					return localNote;
				}

				// if local version is older, but was a result of a bad save
				if (localNote.dirty) {
					// @TODO resolve conflict somehow?
				}
				// if remote version is later, use remote version
				localforage.setItem(getLocalNoteKey(type, profile.id, driveNote.id),
					driveNote);
				list.updateNoteName(driveNote.id, driveNote.name);
			}
			return driveNote;
		});
		// show the fist note
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
		return response;
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
			if (error.message && error.message.startsWith('Configuration:')) {
				config.open(() => {
					notify.clear();
					getDriveNotes();
				});
			}
		});
		return [];
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

let savePending = false;
function saveNote (type, n) {
	if (savePending) {
		// if in the middle of saving, wait 500ms before trying again
		setTimeout(() => {
			saveNote(type, n);
		}, 500);
	}
	var note = findNoteById(n.id);
	var oldNote = note;
	if (!note) {
		throw new Error('Unable to find note ' + n.id);
	}
	if (note.dirty && note.oldNote) {
		oldNote = note.oldNote;
	}
	if (n.content === oldNote.content && n.title === oldNote.name) {
		notify.info('No new change detected.');
		// @TODO remove the dirty flag, which seems erroneous at this point?
		return;
	}

	// request body object
	var updated = {};
	var url = endPoints[type];
	var method = postJson;
	if (n.content !== oldNote.content) {
		updated.content = n.content;
	}
	if (note.new) {
		updated.name = n.title;
	} else {
		url += '/' + encodeURIComponent(note.id);
		method = putJson;
		if (n.title !== oldNote.name) {
			updated.name = n.title;
		}
	}
	notify({
		message: 'Saving note...',
		type: 'blue',
		permanent: true
	});
	savePending = true;
	note.dirty = true;
	note.oldNote = oldNote;
	Object.assign(note, updated);

	editor.freeze();
	method(url, updated, {
		credentials: 'include'
	}).then((resp) => {
		savePending = false;
		notify({
			message: 'Saved!',
			type: 'green'
		});
		editor.unfreeze();
		if (updated.name) {
			list.updateNoteName(note.id, updated.name, resp.id);
		}
		if (note.new) {
			editor.setId(resp.id);
			note.id = resp.id;
			delete note.new;
		}
		if (note.dirty && note.oldNote) {
			delete note.dirty;
			delete note.oldNote;
		}
		localforage.setItem(getLocalNoteKey(type, note.userId, note.id),
			note);

		// switch to view mode after save
		editor.viewMode();
		notify({
			message: 'Saved!',
			type: 'green',
			timeout: 3000
		});
	}, (err) => {
		savePending = false;
		// save to local storage for later re-save

		// @TODO maybe use a more precise timestamp of when textarea on blur?
		// that would mean that after first failure to save,
		// the next time save happens there won't be a new timestamp
		var lastModifiedTime = new Date().toISOString();
		note.modifiedTime = lastModifiedTime;
		localforage.setItem(getLocalNoteKey(type, note.userId, note.id),
			note);
		if (err.response.status === 401) {
			user.authorize('https://www.googleapis.com/auth/drive');
			return;
		}
		notify.error(err);
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
	notify({
		message: 'Deleting note...',
		type: 'blue',
		permanent: true
	});
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

function findNoteById (id, type) {
	// only search in single note type for now
	let _type = type;
	// default to drive
	if (!type) {
		_type = 'drive';
	}
	return notes[_type].find((note) => {
		return note.id === id;
	});
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

// expose utility method (useful to clean up localforage stuff)
window.localF = {
	listAll: function () {
		localforage.iterate((value, key) => {
			console.log(key);
			console.log(value);
		});
	},
	remove: function (key) {
		if (!key) {
			throw new Error('no key to be removed');
		}
		localforage.removeItem(key).then(console.log);
	},
	_: localforage
};
