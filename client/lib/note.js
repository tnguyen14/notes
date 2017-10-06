/* @flow */
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

const apiUrl = process.env.API_URL;
if (!apiUrl) {
	throw new Error('No API URL.');
}

const endPoints = {
	drive: apiUrl + '/drive'
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
				localNote.md5Checksum !== driveNote.md5Checksum) {
				// if 2 versions differ
				// if local version is newer than remote version,
				// store drive version as old note, use local version
				if (moment(driveNote.modifiedTime).isBefore(
						localNote.modifiedTime)) {
					// get remote note content to add to oldNote
					getJson(endPoints.drive + '/' + driveNote.id, {
						credentials: 'include'
					}).then((resp) => {
						driveNote.content = resp.content;
						Object.assign(localNote, {
							oldNote: driveNote
						});
						saveLocalNote(localNote);
					});
					return localNote;
				}

				// if local version is older, but was a result of a bad save
				if (localNote.dirty) {
					// @TODO resolve conflict somehow?
				}
				// if remote version is newer, get the newer content
				getJson(endPoints.drive + '/' + driveNote.id, {
					credentials: 'include'
				}).then((resp) => {
					// @TODO if this is an active note that has been rendered,
					// the new content will not be reflected
					driveNote.content = resp.content;
					saveLocalNote(driveNote);
				});
				list.updateNoteName(driveNote.id, driveNote.name);
				return driveNote;
			} else {
				return localNote;
			}
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
			return user.authorize();
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

function setActiveNote (note) {
	list.setActiveNote(note.id);
	editor.setNote(note);
	if (note.new) {
		editor.writeMode();
	} else {
		editor.viewMode();
	}
	editor.showLoader();
	getJson(endPoints[note.type] + '/' + note.id, {
		credentials: 'include'
	}).then((resp) => {
		let content = resp.content;
		// if the same content, nothing to do
		if (!note.content) {
			note.content = content;
			editor.setContent(content);
			saveLocalNote(note);
			// toggle mode again
			if (note.new) {
				editor.writeMode();
			} else {
				editor.viewMode();
			}
		}
		if (note.content !== content) {
			// if the note is dirty already, try to save it
			if (note.dirty) {
				saveNote(note);
			} else {
				// @TODO what would this case be?
				console.log('Please report this!');
			}
		}
		editor.hideLoader();
	}, (err) => {
		if (err.response.status === 401) {
			return user.authorize();
		}
		err.response.json().then((error) => {
			notify({
				type: 'red',
				message: 'Error retrieving note: ' + error.message,
				permanent: true
			});
		});
	});
}

let savePending = false;
function saveNote (n) {
	if (savePending) {
		// if in the middle of saving, wait 500ms before trying again
		setTimeout(() => {
			saveNote(n);
		}, 500);
	}

	if (!n.id) {
		throw new Error('Missing note ID.');
	}
	var note = findNoteById(n.id);
	if (note == null) {
		throw new Error('Unable to find note ' + n.id);
	}
	// oldNote is the previous version to compare with
	var oldNote = note;

	// if there was already an old note, use that
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

	note.dirty = true;
	list.updateNoteStatus(note.id, note.dirty);

	// updated is request body object
	var updated = {};
	var url = endPoints[note.type];
	var method = postJson;
	if (n.content !== oldNote.content) {
		updated.content = n.content;
	}
	if (note.new) {
		updated.name = n.title;
	} else {
		// if updating existing note, use PUT
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
	// storing reference of oldNote
	note.oldNote = oldNote;

	Object.assign(note, updated);

	editor.freeze();
	method(url, updated, {
		credentials: 'include'
	}).then((resp) => {
		savePending = false;
		notify.success('All changes saved!');
		editor.unfreeze();

		// checking for note again, due to a flow issue
		// https://github.com/facebook/flow/issues/2986
		// @TODO: to be removed
		if (note == null) {
			throw new Error('Note cannot be null or undefined ');
		}

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
	}, (err) => {
		// checking for note again, due to a flow issue
		// https://github.com/facebook/flow/issues/2986
		// @TODO: to be removed
		if (note == null) {
			throw new Error('Note cannot be null or undefined ');
		}

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
			user.authorize();
			return;
		}
		notify.error(err);
	});
}

function removeNote (id) {
	if (!id) {
		throw new Error('Note ID is missing.');
	}
	var note = findNoteById(id);
	if (!note) {
		throw new Error('Could not find note by ID ' + id);
	}
	let noteIndex = notes[note.type].indexOf(note);
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
		deleteAction = deleteJson(endPoints[note.type] + '/' +
			encodeURIComponent(note.id), {
				credentials: 'include'
			});
	}
	deleteAction.then(function () {
		// checking for note again, due to a flow issue
		// https://github.com/facebook/flow/issues/2986
		// @TODO: to be removed
		if (!note) {
			throw new Error('No note found');
		}
		list.removeNote(note.id);
		removeLocalNote(note);
		notes[note.type].splice(noteIndex, 1);
		notify({
			message: 'Successfully deleted note.',
			type: 'green',
			timeout: 3000
		});
		// show the next note
		_note.emit('note:activate', notes[note.type][0]);
	});
}

/* find note by property
 * if no property value is proided, the first note of type 'drive' is returned.
 * if no type is provided, the first note found with the property value across
 * all types is returned.
 * if no note is found, return undefined.
 * @param {string} prop the property to check on
 * @param {string} [propValue] value of property to check against
 * @param {string} [type] note type
 */
function findNoteByProperty (prop, propValue, type) {
	let _prop = prop || 'id';
	// if no propValue is declared, return the first note of type 'drive'
	if (!propValue) {
		return notes['drive'][0];
	}
	if (type) {
		return notes[type].find((note) => {
			return note[_prop] === propValue;
		});
	}
	// if no type is defined, loop through all types, return the first one found
	let foundNote;
	for (let _type of Object.keys(notes)) {
		foundNote = notes[_type].find((note) => {
			return note[_prop] === propValue;
		});
		if (foundNote) {
			break;
		}
	}
	return foundNote;
}

function findNoteById (id, type) {
	return findNoteByProperty('id', id, type);
}

function findNoteByName (name, type) {
	return findNoteByProperty('name', name, type);
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
