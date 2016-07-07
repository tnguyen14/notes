var editor = require('./editor');

function createNoteLi (note) {
	var li = document.createElement('li');
	li.innerHTML = note.name;
	li.setAttribute('data-path', note.path);
	li.addEventListener('click', showNote.bind(window, li, note));
	return li;
}

function showNote (li, note) {
	Array.prototype.forEach.call(li.parentNode.querySelectorAll('li'), function (li) {
		li.classList.remove('selected');
	});
	li.classList.add('selected');
	editor.updateContent(note.content);
	editor.updateTitle(note.name);
	editor.viewMode();
}

module.exports = {
	createNoteLi: createNoteLi,
	showNote: showNote
};
