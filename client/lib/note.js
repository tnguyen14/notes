const Promise = require('bluebird');
const localforage = require('localforage');
const moment = require('moment');
const EventEmitter = require('eventemitter3');
const simpleFetch = require('simple-fetch');
const getJson = simpleFetch.getJson;
const postJson = simpleFetch.postJson;
const putJson = simpleFetch.putJson;
const deleteJson = simpleFetch.deleteJson;
const config = require('../components/config');
const editor = require('../components/editor');
const list = require('../components/list');
const notify = require('./notify');
const user = require('./user');

const localForageSeparator = '!';

const _note = Object.assign(new EventEmitter(), {
	getNotes,
	findNoteById,
	findNoteByName,
	setActiveNote
});

module.exports = _note;

localforage.config({
	name: 'inspiredNotes'
});

let notes = {
	drive: []
};

window.notes = notes;

const NEWNOTE = {
	id: 'Untitled/index.md',
	name: 'Untitled',
	content: '',
	new: true
};

const endPoints = {
	drive: process.env.API_URL + '/drive'
};

// event handlers registration
editor.on('note:save', saveNote);
editor.on('note:remove', removeNote);

// sort by modified time
function compareNotes (a, b) {
	if (moment(a.modifiedTime).isAfter(b.modifiedTime)) {
		return -1;
	} else if (moment(a.modifiedTime).isBefore(b.modifiedTime)) {
		return 1;
	}
	return 0;
}

function getNotes (profile) {
	let type = 'drive';

	// listen inside this function to get access to profile ID
	list.on('note:add', (type) => {
		createNote(type, profile.id);
	});

	getJson(endPoints[type] + '/me', {  // get config
		credentials: 'include'
	}).then((config) => {
		list.renderLabel(type, config.label);
		list.createNoteChoice(config.label, type);
	});
	return Promise.all([
		getDriveNotes(),
		getLocalNotes(type, profile.id).then((localNotes) => {
			// eagerly render localNotes first
			notes[type] = localNotes;
			// sort by modified times
			localNotes.sort(compareNotes);
			list.renderNotes(type, localNotes);
			return localNotes;
		})
	]).then((res) => {
		let [driveNotes, localNotes] = res;
		let hasMatchingRemote = [];
		notes[type] = driveNotes.map((driveNote) => {
			let localNote = localNotes.find(n => n.id === driveNote.id);
			if (!localNote) {
				// if local note has not exist, store it and render it
				saveLocalNote(driveNote);
				list.renderNote(type, driveNote);
				return driveNote;
			}
			hasMatchingRemote.push(localNote.id);
			if (localNote.name !== driveNote.name ||
				localNote.content !== driveNote.content) {
				// if 2 versions differ
				// if local version is newer than remote version,
				// store drive version as old note, use local version
				if (moment(driveNote.modifiedTime).isBefore(
						localNote.modifiedTime)) {
					Object.assign(localNote, {
						oldNote: driveNote
					});
					saveLocalNote(localNote);
					return localNote;
				}

				// if local version is older, but was a result of a bad save
				if (localNote.dirty) {
					// @TODO resolve conflict somehow?
				}
				// if remote version is newer, use remote version
				saveLocalNote(driveNote);
				// @TODO why set name here?
				list.updateNoteName(driveNote.id, driveNote.name);
			} else {
				saveLocalNote(localNote);
			}
			return driveNote;
		});

		localNotes.forEach((localNote) => {
			if (!hasMatchingRemote.includes(localNote.id)) {
				if (localNote.new) {
					// if new note that has not been saved, put it first
					// to make it active
					notes[type].unshift(localNote);
				} else {
					// if local note is not new and does not have matching
					// remote version, then remove it
					list.removeNote(localNote.id);
					removeLocalNote(localNote);
				}
			}
		});

		// sort notes again
		notes[type].sort(compareNotes);
	});
}

function getDriveNotes () {
	list.showLoader();
	return getJson(endPoints.drive, {
		credentials: 'include'
	}).then((response) => {
		list.hideLoader();
		return response;
	}, (err) => {
		list.hideLoader();
		if (err.response.status === 401) {
			return user.authorize('https://www.googleapis.com/auth/drive');
		}
		err.response.json().then((error) => {
			notify({
				type: 'red',
				message: 'Error in getting Google Drive notes: ' +
					error.message,
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

function createNote (type, profileId) {
	var note = Object.assign({}, NEWNOTE, {
		type: type,
		userId: profileId
	});
	notes[type].push(note);
	// insert before the first one
	list.renderNote(type, note, notes[type][0].id);
	_note.emit('note:create', note);
}

function setActiveNote (note, writeMode) {
	list.setActiveNote(note.id);
	editor.setNote(note);
	if (writeMode) {
		editor.writeMode();
	} else {
		editor.viewMode();
	}
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
	// if the note is new, compare with the stump NEWNOTE object instead
	if (note.new) {
		oldNote = NEWNOTE;
	}
	if (n.content === oldNote.content && n.title === oldNote.name) {
		notify.info('No new change detected.');
		// if there is no change but note was marked as dirty, remove that flag
		if (note.dirty) {
			delete note.dirty;
			delete note.oldNote;
			saveLocalNote(note);
			list.updateNoteStatus(note.id);
		}
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
			note.name = updated.name;
		}
		if (note.new) {
			editor.setId(resp.id);
			note.id = resp.id;
			note.userId = resp.userId;
			delete note.new;
			// trigger note:create event again to update page link
			// not sure if triggering the same event is the right idea,
			// or create a new event, and handle it the same way in router
			_note.emit('note:create', note);
		}
		if (note.dirty && note.oldNote) {
			delete note.dirty;
			delete note.oldNote;
		}
		saveLocalNote(note);
		list.updateNoteStatus(note.id);

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
		saveLocalNote(note);
		list.updateNoteStatus(note.id, note.dirty);
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
	let deleteAction;
	// if new note, just remove it from memory and local storage
	if (note.new) {
		deleteAction = Promise.resolve();
	} else {
		deleteAction = deleteJson(endPoints[type] + '/' +
			encodeURIComponent(note.id), {
				credentials: 'include'
			});
	}
	deleteAction.then(function () {
		list.removeNote(note.id);
		removeLocalNote(note);
		notes[type].splice(noteIndex, 1);
		notify({
			message: 'Successfully deleted note.',
			type: 'green',
			timeout: 3000
		});
		// show the next note
		_note.emit('note:activate', notes[type][0]);
	});
}

/* find note by ID
 * @param {string} [id] note ID. If no ID is provided, return the first
 *                      note of default type
 * @param {string} [type] note type, default to 'drive'
 */
function findNoteById (id, type) {
	// default to drive
	let _type = type || 'drive';
	if (!id) {
		return notes[_type][0];
	}
	return notes[_type].find((note) => {
		return note.id === id;
	});
}

function findNoteByName (name, type) {
	let _type = type || 'drive';
	return notes[_type].find((note) => {
		return note.name === name;
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

function saveLocalNote (note) {
	if (!note.type || !note.userId || !note.id) {
		return Promise.reject('Missing required note properties');
	}
	let noteKey = getLocalNoteKey(note.type, note.userId, note.id);
	return localforage.setItem(noteKey, note);
}

function removeLocalNote (note) {
	if (!note.type || !note.userId || !note.id) {
		return Promise.reject('Missing required note properties');
	}
	let noteKey = getLocalNoteKey(note.type, note.userId, note.id);
	return localforage.removeItem(noteKey);
}
// expose utility method (useful to clean up localforage stuff)
window._localF = {
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
