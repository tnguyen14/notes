/* global Event */
var EventEmitter = require('eventemitter3');
var dialogPolyfill = require('dialog-polyfill');
var md = require('markdown-it')({
	breaks: true
})
	.use(require('markdown-it-task-lists'))
	.use(require('markdown-it-front-matter'), updateMetadata);
var yaml = require('js-yaml');

const loader = require('../lib/loader');

const editor = Object.assign(new EventEmitter(), {
	getTitle,
	getContent,
	setNote,
	setId,
	setContent,
	startListening,
	viewMode,
	writeMode,
	freeze,
	unfreeze,
	showLoader,
	hideLoader
});

module.exports = editor;

var container = document.querySelector('.editor-container');
var metadataEl = document.querySelector('.metadata');
var title = document.querySelector('.title');
var textarea = document.querySelector('.write-content textarea');
var viewButton = document.querySelector('.view-button');
var writeButton = document.querySelector('.write-button');
var form = document.querySelector('form');
var view = document.querySelector('.view-content .markdown-body');
var remove = container.querySelector('.remove');
var deleteConfirm = document.querySelector('dialog.delete-confirm');

// polyfill dialog
dialogPolyfill.registerDialog(deleteConfirm);

// https://github.com/benjamingr/RegExp.escape
if (!RegExp.escape) {
	RegExp.escape = function (s) {
		return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	};
}

function setTitle (text) {
	title.value = text;
}

function getTitle () {
	return title.value;
}

function setContent (content) {
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

function setType (type) {
	container.setAttribute('data-type', type);
}

function setNote (note) {
	setId((note && note.id) ? note.id : '');
	setType((note && note.type) ? note.type : '');
	setTitle((note && note.name) ? note.name : '');
	setContent((note && note.content) ? note.content : '');
}

function updateMetadata (frontmatter) {
	// clear out existing metadata
	metadataEl.innerHTML = '';
	if (!frontmatter) {
		container.classList.remove('has-tags');
		return;
	}
	var metadata = yaml.safeLoad(frontmatter);
	if (metadata.tags) {
		container.classList.add('has-tags');
		var tagsEl = metadataEl.appendChild(document.createElement('div'));
		tagsEl.classList.add('tags');
		var labelEl = tagsEl.appendChild(document.createElement('span'));
		labelEl.classList.add('label');
		labelEl.innerText = 'tags: ';
		var valuesEl = tagsEl.appendChild(document.createElement('span'));
		valuesEl.classList.add('values');
		var tags = metadata.tags.split(',').map(function (t) {
			return t.trim();
		});
		tags.forEach(function (tag) {
			var tagEl = valuesEl.appendChild(document.createElement('span'));
			tagEl.classList.add('value');
			tagEl.innerText = tag;
		});
	} else {
		container.classList.remove('has-tags');
	}
}

function showLoader () {
	loader.show(container);
}

function hideLoader () {
	loader.hide(container);
}

function triggerNoteSaveEvent () {
	editor.emit('note:save', {
		id: getId(),
		title: getTitle(),
		content: getContent()
	});
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

	remove.addEventListener('click', function () {
		deleteConfirm.showModal();
	});

	deleteConfirm.querySelector('.cancel').addEventListener('click', function () {
		deleteConfirm.close();
	});
	deleteConfirm.querySelector('.confirm').addEventListener('click', function () {
		deleteConfirm.close();
		editor.emit('note:remove', getId());
	});

	// autosave
	let typingTimer;
	let doneTypingInterval = 5000;
	textarea.addEventListener('input', function () {
		clearTimeout(typingTimer);
		typingTimer = setTimeout(triggerNoteSaveEvent, doneTypingInterval);
	});
}

function writeMode () {
	viewButton.classList.remove('selected');
	writeButton.classList.add('selected');
	form.classList.add('write-selected');
	textarea.focus();
	unfreeze();
}

function viewMode () {
	writeButton.classList.remove('selected');
	viewButton.classList.add('selected');
	form.classList.remove('write-selected');
	var content = getContent();
	// reset metadata first
	updateMetadata();
	view.innerHTML = md.render(content);
	freeze();

	// handle markdown tasklists checkbox toggles
	Array.prototype.forEach.call(view.querySelectorAll('input[type=checkbox].task-list-item-checkbox'), function (input) {
		input.removeAttribute('disabled');
		input.addEventListener('change', function (e) {
			let inputText = input.parentNode.textContent.trim();
			let noteText = getContent();
			if (input.checked) {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[\\s\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[x]$2');
			} else {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[x\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[ ]$2');
			}
			setContent(noteText);
			textarea.dispatchEvent(new Event('input'));
		});
	});
}

function freeze () {
	title.setAttribute('disabled', 'disabled');
	textarea.setAttribute('disabled', 'disabled');
}

function unfreeze () {
	title.removeAttribute('disabled');
	textarea.removeAttribute('disabled');
}
