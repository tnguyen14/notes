var loader = require('../lib/loader');

var listsContainer = document.querySelector('.lists');

var onNoteClickHandler;

module.exports = {
	showLoader,
	hideLoader,
	renderLabel,
	renderNotes,
	renderNote,
	setActiveNote,
	removeNote,
	updateNoteName,
	updateNoteStatus,
	registerOnNoteClickHandler
};

function showLoader (type) {
	loader.show(getUl(type));
}

function hideLoader (type) {
	loader.hide(getUl(type));
}

function renderLabel (type, label) {
	getUl(type).parentNode.querySelector('h3').innerHTML = label;
}

function renderNotes (type, notes) {
	notes.forEach(renderNote.bind(window, type));
}
//
// add note to list
function renderNote (type, note) {
	var li = document.createElement('li');
	note.type = type;
	li.innerHTML = note.name;
	li.classList.add('list-item');
	li.setAttribute('data-id', note.id);
	li.addEventListener('click', (e) => {
		setActiveNote(note.id);
		if (onNoteClickHandler && typeof onNoteClickHandler === 'function') {
			onNoteClickHandler(type, note);
		}
	});
	getUl(type).appendChild(li);
	updateNoteStatus(note.id, note.dirty);
}

function registerOnNoteClickHandler (handler) {
	onNoteClickHandler = handler;
}

function setActiveNote (noteId) {
	var li = getNoteLi(noteId);
	Array.prototype.forEach.call(listsContainer.querySelectorAll('.lists .list-item'), function (l) {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
}

function removeNote (noteId) {
	var li = getNoteLi(noteId);
	li.parentNode.removeChild(li);
}

function updateNoteName (noteId, newName, newId) {
	var li = getNoteLi(noteId);
	li.innerHTML = newName;
	if (newId) {
		li.setAttribute('data-id', newId);
	}
}

function updateNoteStatus (noteId, dirty) {
	var li = getNoteLi(noteId);
	if (dirty) {
		li.classList.add('dirty');
	} else {
		li.classList.remove('dirty');
	}
}

var listUls = {};
function getUl (type) {
	// only search once
	if (listUls[type]) {
		return listUls[type];
	}
	return listsContainer.querySelector('.list.' + type + ' ul');
}

function getNoteLi (noteId) {
	if (!noteId) {
		throw new Error('No note ID provided.');
	}
	var li = listsContainer.querySelector('[data-id="' + noteId + '"]');
	if (!li) {
		throw new Error('Could not locate note ' + noteId + ' on the list');
	}
	return li;
}