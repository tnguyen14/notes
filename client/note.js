var editor = require('./editor');

function createNoteLi (note, type) {
	var li = document.createElement('li');
	li.innerHTML = note.name;
	li.setAttribute('data-id', note.id);
	li.addEventListener('click', showNote.bind(window, li, note));
	return li;
}

function showNote (li, note) {
	Array.prototype.forEach.call(li.parentNode.querySelectorAll('li'), function (li) {
		li.classList.remove('selected');
	});
	li.classList.add('selected');
	editor.setNote(note);
	editor.viewMode();
}

module.exports = {
	createNoteLi: createNoteLi,
	showNote: showNote
};
