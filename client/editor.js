var md = require('markdown-it')({
	breaks: true
})
	.use(require('markdown-it-task-lists'));

var handlers = {};

var container = document.querySelector('.editor-container');
var title = document.querySelector('.title');
var textarea = document.querySelector('.write-content textarea');
var viewButton = document.querySelector('.view-button');
var writeButton = document.querySelector('.write-button');
var form = document.querySelector('form');
var view = document.querySelector('.view-content .markdown-body');
var save = container.querySelector('.save');
var remove = container.querySelector('.remove');
var deleteConfirm = document.querySelector('dialog.delete-confirm');

// https://github.com/benjamingr/RegExp.escape
if (!RegExp.escape) {
	RegExp.escape = function (s) {
		return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	};
}

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

function getId () {
	return container.getAttribute('data-id');
}

function setId (id) {
	container.setAttribute('data-id', id || '');
}

function getType () {
	return container.getAttribute('data-type');
}

function setType (type) {
	container.setAttribute('data-type', type);
}

function setNote (note) {
	setId((note && note.id) ? note.id : '');
	setType((note && note.type) ? note.type : '');
	updateTitle((note && note.name) ? note.name : '');
	updateContent((note && note.content) ? note.content : '');
}

function startListening () {
	Array.prototype.forEach.call(container.querySelectorAll('.tabnav button'), function (button) {
		button.addEventListener('click', function () {
			if (writeButton.classList.contains('selected')) {
				viewMode();
			} else {
				writeMode();
			}
		});
	});

	save.addEventListener('click', function () {
		if (handlers.save) {
			handlers.save(getType(), {
				id: getId(),
				title: getTitle(),
				content: getContent()
			});
		}
	});
	remove.addEventListener('click', function () {
		deleteConfirm.showModal();
	});

	deleteConfirm.querySelector('.cancel').addEventListener('click', function () {
		deleteConfirm.close();
	});
	deleteConfirm.querySelector('.confirm').addEventListener('click', function () {
		deleteConfirm.close();
		if (handlers.remove) {
			handlers.remove(getType(), getId());
		}
	});
}

function registerSaveHandler (handler) {
	if (typeof handler !== 'function') {
		return;
	}
	handlers.save = handler;
}

function registerRemoveHandler (handler) {
	if (typeof handler !== 'function') {
		return;
	}
	handlers.remove = handler;
}

function writeMode () {
	viewButton.classList.remove('selected');
	writeButton.classList.add('selected');
	form.classList.add('write-selected');
	textarea.focus();
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
	getTitle: getTitle,
	getContent: getContent,
	setNote: setNote,
	setId: setId,
	startListening: startListening,
	viewMode: viewMode,
	writeMode: writeMode,
	registerSaveHandler: registerSaveHandler,
	registerRemoveHandler: registerRemoveHandler
};
