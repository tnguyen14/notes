var loader = require('../lib/loader');

var listsContainer = document.querySelector('.lists');

var onNoteClickHandler;

module.exports = {
	showLoader,
	hideLoader,
	renderNotes,
	renderNote,
	setActiveNote,
	removeNote,
	updateNoteName,
	registerOnNoteClickHandler
};

function showLoader (type) {
	loader.show(getUl(type));
}

function hideLoader (type) {
	loader.hide(getUl(type));
}

function renderNotes (type, response) {
	getUl(type).parentNode.querySelector('h3').innerHTML = response.label;
	response.notes.forEach(renderNote.bind(window, type));
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
			onNoteClickHandler(note);
		}
	});
	getUl(type).appendChild(li);
}

function registerOnNoteClickHandler (handler) {
	onNoteClickHandler = handler;
}

function setActiveNote (noteId) {
	if (!noteId) {
		return;
	}

	var li = listsContainer.querySelector('[data-id="' + noteId + '"]');
	if (!li) {
		return;
	}
	Array.prototype.forEach.call(listsContainer.querySelectorAll('.lists .list-item'), function (l) {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
}

function removeNote (noteId) {
	var li = listsContainer.querySelector('[data-id="' + noteId + '"]');
	if (!li) {
		throw new Error('Could not locate note ' + noteId + ' on the list');
	}
	li.parentNode.removeChild(li);
}

function updateNoteName (noteId, newName, newId) {
	var li = listsContainer.querySelector('[data-id="' + noteId + '"]');
	if (!li) {
		throw new Error('Could not locate note ' + noteId + ' on the list');
	}
	li.innerHTML = newName;
	li.setAttribute('data-id', newId);
}

var listUls = {};
function getUl (type) {
	// only search once
	if (listUls[type]) {
		return listUls[type];
	}
	return listsContainer.querySelector('.list.' + type + ' ul');
}
