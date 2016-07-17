var editor = require('./editor');
var add = require('./add');

function addNote (type, note) {
	var list = document.querySelector('.list.' + type + ' ul');
	var li = document.createElement('li');
	li.innerHTML = note.name;
	li.classList.add('list-item');
	li.setAttribute('data-id', note.id);
	li.addEventListener('click', showNote.bind(window, note));
	list.appendChild(li);
	return li;
}

function renderNotes (opts) {
	var list = document.querySelector('.list.' + opts.type + ' ul');
	list.parentNode.querySelector('h3').innerHTML = opts.label;
	opts.notes.forEach(addNote.bind(window, opts.type));
	add.registerHandler({
		label: opts.label,
		type: opts.type,
		handler: opts.addHandler
	});
}

function showNote (note) {
	var li = document.querySelector('[data-id="' + note.id + '"]');
	if (!li) {
		return;
	}
	Array.prototype.forEach.call(document.querySelectorAll('.lists .list-item'), function (l) {
		l.classList.remove('selected');
	});
	li.classList.add('selected');
	editor.setNote(note);
	editor.viewMode();
}

module.exports = {
	addNote: addNote,
	renderNotes: renderNotes,
	showNote: showNote
};
