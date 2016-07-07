var md = require('markdown-it')()
	.use(require('markdown-it-task-lists'));
var title = document.querySelector('.title');
var textarea = document.querySelector('.write-content textarea');
var viewButton = document.querySelector('.view-button');
var writeButton = document.querySelector('.write-button');
var form = document.querySelector('form');
var view = document.querySelector('.view-content .markdown-body');

function updateTitle (text) {
	title.value = text;
}

function getTitle () {
	return title.value;
}

function updateContent (content) {
	textarea.value = content || '';
}

function getContent () {
	return textarea.value;
}

function writeMode () {
	viewButton.classList.remove('selected');
	writeButton.classList.add('selected');
	form.classList.add('write-selected');
	textarea.focus();
}

function setNew(isNew) {
	if (isNew) {
		form.setAttribute('data-new', 'true');
	} else {
		form.setAttribute('data-new', 'false');
	}
}

function isNew () {
	return form.getAttribute('data-new', 'true');
}

function isWriting () {
	return writeButton.classList.contains('selected');
}

function viewMode () {
	writeButton.classList.remove('selected');
	viewButton.classList.add('selected');
	form.classList.remove('write-selected');
	var content = getContent();
	view.innerHTML = md.render(content);
	Array.prototype.forEach.call(view.querySelectorAll('input[type=checkbox].task-list-item-checkbox'), function (input) {
		input.removeAttribute('disabled');
		input.addEventListener('change', function (e) {
			var inputText = input.parentNode.textContent.trim();
			var noteText = getContent();
			if (input.checked) {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[\\s\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[x]$2');
			} else {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[x\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[ ]$2');
			}
			updateContent(noteText);
		});
	});
}

module.exports = {
	updateTitle: updateTitle,
	getTitle: getTitle,
	updateContent: updateContent,
	getContent: getContent,
	setNew: setNew,
	isNew: isNew,
	isWriting: isWriting,
	viewMode: viewMode,
	writeMode: writeMode
};
