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
		e.target.classList.toggle('active');
		listsEl.classList.toggle('active');
		editorEl.classList.toggle('lists-active');
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
