var config = require('./config');
var user = require('./lib/user');
var addNoteChoice = document.querySelector('.add-note-choice');
var handlers = {};

function startListening () {
	// add button
	document.querySelector('.menu .add').addEventListener('click', addNoteChoice.showModal.bind(addNoteChoice));
	addNoteChoice.addEventListener('click', function (e) {
		if (!e.target.classList.contains('add-option')) {
			return;
		}
		addNoteChoice.close();
		var type = e.target.getAttribute('data-type');
		if (handlers[type] && typeof handlers[type] === 'function') {
			handlers[type]();
		}
	});

	// list toggle
	var listsEl = document.querySelector('.lists');
	var editorEl = document.querySelector('.editor-container');
	document.querySelector('.menu .toggle').addEventListener('click', function (e) {
		var button = e.currentTarget;
		button.classList.toggle('collapse');
		listsEl.classList.toggle('active');
		editorEl.classList.toggle('lists-active');
		// swap labels
		var currentLabel = button.getAttribute('aria-label');
		var newLabel = button.getAttribute('data-label-alt');
		button.setAttribute('aria-label', newLabel);
		button.setAttribute('data-label-alt', currentLabel);
	});

	// config
	document.querySelector('.menu .config').addEventListener('click', function (e) {
		config.open();
	});
}

function registerHandler (opt) {
	var option = document.createElement('button');
	option.innerHTML = opt.label;
	option.setAttribute('data-type', opt.type);
	option.classList.add('add-option');
	addNoteChoice.appendChild(option);
	handlers[opt.type] = opt.handler;
}

function setProfile (profile) {
	// profile image
	var profileEl = document.querySelector('.menu .profile');
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
	var options = document.createElement('div');
	options.classList.add('options');
	var logout = document.createElement('a');
	logout.innerText = 'Log Out';
	logout.setAttribute('href', user.logoutUrl);
	options.appendChild(logout);
	profileEl.appendChild(options);

	profileEl.addEventListener('click', function (e) {
		e.currentTarget.classList.toggle('active');
	});

	profileEl.setAttribute('aria-label', profile.displayName);
}

module.exports = {
	startListening: startListening,
	registerHandler: registerHandler,
	setProfile: setProfile
};
