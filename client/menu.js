var config = require('./config');
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
		var button;
		if (e.target.nodeName === 'BUTTON') {
			button = e.target;
		} else if (e.target.nodeName === 'svg') {
			button = e.target.parentNode;
		}
		button.classList.toggle('active');
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

module.exports = {
	startListening: startListening,
	registerHandler: registerHandler
};
