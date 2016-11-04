var dialogPolyfill = require('dialog-polyfill');
var EventEmitter = require('eventemitter3');
var config = require('./config');
var user = require('../lib/user');
var addNoteChoice = document.querySelector('.add-note-choice');

const menu = Object.assign(new EventEmitter(), {
	startListening,
	createNoteChoice,
	setProfile
});

module.exports = menu;

// polyfill dialog
dialogPolyfill.registerDialog(addNoteChoice);

function startListening () {
	// add button
	document.querySelector('.menu .add').addEventListener('click', addNoteChoice.showModal.bind(addNoteChoice));
	addNoteChoice.addEventListener('click', function (e) {
		if (!e.target.classList.contains('add-option')) {
			return;
		}
		addNoteChoice.close();
		var type = e.target.getAttribute('data-type');
		menu.emit('note:add', type);
	});
}

function createNoteChoice (label, type) {
	var option = document.createElement('button');
	option.innerHTML = label;
	option.setAttribute('data-type', type);
	option.classList.add('add-option');
	addNoteChoice.appendChild(option);
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
