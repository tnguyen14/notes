const dialogPolyfill = require('dialog-polyfill');
const EventEmitter = require('eventemitter3');
const config = require('./config');
const user = require('../lib/user');
const loader = require('../lib/loader');

const listsContainer = document.querySelector('.lists');

const list = Object.assign(new EventEmitter(), {
	showLoader,
	hideLoader,
	renderLabel,
	renderNotes,
	renderNote,
	setActiveNote,
	removeNote,
	updateNoteName,
	updateNoteStatus,
	startListening,
	createNoteChoice,
	setProfile
});

module.exports = list;

function showLoader () {
	loader.show(listsContainer);
}

function hideLoader () {
	loader.hide(listsContainer);
}

function renderLabel (type, label) {
	getUl(type).parentNode.querySelector('h3').innerHTML = label;
}

function renderNotes (type, notes) {
	notes.forEach((note) => {
		renderNote(type, note);
	});
}
//
// add note to list
function renderNote (type, note, noteIdToInsertBefore) {
	let li = document.createElement('li');
	let a = document.createElement('a');
	a.innerHTML = note.name;
	a.setAttribute('href', note.name);
	a.setAttribute('data-navigo', '');
	li.appendChild(a);
	li.classList.add('list-item');
	li.setAttribute('data-id', note.id);
	if (noteIdToInsertBefore) {
		let refNode = getNoteLi(noteIdToInsertBefore);
		getUl(type).insertBefore(li, refNode);
	} else {
		getUl(type).appendChild(li);
	}
	updateNoteStatus(note.id, note.dirty);
}

function setActiveNote (noteId) {
	let li = getNoteLi(noteId);
	Array.prototype.forEach.call(listsContainer.querySelectorAll('.lists .list-item'), (l) => {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
	// for small viewport, if clicking on note, show the content container
	if (window.matchMedia('(max-width: 45em)').matches) {
		toggleLists();
	}
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

function toggleLists () {
	let button = document.querySelector('.lists-toggle');
	button.classList.toggle('collapse');
	document.body.classList.toggle('lists-active');
	// swap labels
	let currentLabel = button.getAttribute('aria-label');
	let newLabel = button.getAttribute('data-label-alt');
	button.setAttribute('aria-label', newLabel);
	button.setAttribute('data-label-alt', currentLabel);
}

const addNoteChoiceDialogEl = document.querySelector('.add-note-choice');
// polyfill dialog
dialogPolyfill.registerDialog(addNoteChoiceDialogEl);

function startListening () {
	document.querySelector('.lists-toggle').addEventListener('click', (e) => {
		toggleLists();
	});
	// add button
	document.querySelector('.add').addEventListener('click', addNoteChoiceDialogEl.showModal.bind(addNoteChoiceDialogEl));
	addNoteChoiceDialogEl.addEventListener('click', function (e) {
		if (!e.target.classList.contains('add-option')) {
			return;
		}
		addNoteChoiceDialogEl.close();
		var type = e.target.getAttribute('data-type');
		list.emit('note:add', type);
	});
}

function createNoteChoice (label, type) {
	var option = document.createElement('button');
	option.innerHTML = label;
	option.setAttribute('data-type', type);
	option.classList.add('add-option');
	addNoteChoiceDialogEl.appendChild(option);
}

function setProfile (profile) {
	// profile image
	var profileEl = document.querySelector('.profile');
	var image;
	if (profile.photos.length > 0) {
		image = document.createElement('img');
		image.src = profile.photos[0].value;
	} else {
		image = document.createElement('span');
		image.innerText = profile.displayName[0].toUpperCase();
	}
	image.classList.add('image');
	profileEl.appendChild(image);

	// profile options
	var options = document.createElement('ul');
	options.classList.add('options');
	var name = document.createElement('li');
	name.innerText = profile.displayName;
	name.classList.add('name');
	options.appendChild(name);

	var configurations = document.createElement('a');
	configurations.innerText = 'Configurations';
	configurations.setAttribute('href', 'config');
	configurations.addEventListener('click', (e) => {
		e.preventDefault();
		config.open();
	});
	options.appendChild(document.createElement('li'))
		.appendChild(configurations);

	var logout = document.createElement('a');
	logout.innerText = 'Log Out';
	logout.setAttribute('href', user.logoutUrl);
	options.appendChild(document.createElement('li'))
		.appendChild(logout);
	profileEl.appendChild(options);

	profileEl.addEventListener('click', function (e) {
		e.currentTarget.classList.toggle('active');
	});

	return profile;
}
