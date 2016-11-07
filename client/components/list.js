const loader = require('../lib/loader');

const listsContainer = document.querySelector('.lists');

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
	startListening
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
	let li = document.createElement('li');
	let a = document.createElement('a');
	a.innerHTML = note.name;
	a.setAttribute('href', note.name);
	a.setAttribute('data-navigo', '');
	li.appendChild(a);
	li.classList.add('list-item');
	li.setAttribute('data-id', note.id);
	getUl(type).appendChild(li);
	updateNoteStatus(note.id, note.dirty);
}

function setActiveNote (noteId) {
	let li = getNoteLi(noteId);
	Array.prototype.forEach.call(listsContainer.querySelectorAll('.lists .list-item'), (l) => {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
}

function removeNote (noteId) {
	let li = getNoteLi(noteId);
	li.parentNode.removeChild(li);
}

function updateNoteName (noteId, newName, newId) {
	let li = getNoteLi(noteId);
	li.querySelector('a').innerHTML = newName;
	if (newId) {
		li.setAttribute('data-id', newId);
	}
}

function updateNoteStatus (noteId, dirty) {
	let li = getNoteLi(noteId);
	if (dirty) {
		li.classList.add('dirty');
	} else {
		li.classList.remove('dirty');
	}
}

let listUls = {};
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
	let li = listsContainer.querySelector('[data-id="' + noteId + '"]');
	if (!li) {
		throw new Error('Could not locate note ' + noteId + ' on the list');
	}
	return li;
}

function startListening () {
	document.querySelector('.lists-toggle').addEventListener('click', (e) => {
		let button = e.currentTarget;
		button.classList.toggle('collapse');
		document.body.classList.toggle('lists-active');
		// swap labels
		let currentLabel = button.getAttribute('aria-label');
		let newLabel = button.getAttribute('data-label-alt');
		button.setAttribute('aria-label', newLabel);
		button.setAttribute('data-label-alt', currentLabel);
	});
}
