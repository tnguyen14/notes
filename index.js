var md = require('markdown-it')()
	.use(require('markdown-it-task-lists'));
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var endPoint = '/api/notes';

var previewButton = document.querySelector('.preview-button');
var writeButton = document.querySelector('.write-button');
var textarea = document.querySelector('.write-content textarea');
var title = document.querySelector('.title');
var preview = document.querySelector('.preview-content .markdown-body');
var list = document.querySelector('.list ul');
var form = document.querySelector('form');

// https://github.com/benjamingr/RegExp.escape
if (!RegExp.escape) {
	RegExp.escape = function (s) {
		return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	};
}

var notes;

Array.prototype.forEach.call(document.querySelectorAll('.tabnav button'), function (button) {
	button.addEventListener('click', function (e) {
		var isWriting = writeButton.classList.contains('selected');
		if (isWriting) {
			previewMode();
		} else {
			writeMode();
		}
	});
});

document.querySelector('.save').addEventListener('click', saveNote);
document.querySelector('.add').addEventListener('click', newNote);

getJson(endPoint).then(function (_notes) {
	notes = _notes;
	notes.forEach(function (note, index) {
		list.appendChild(createNoteLi(note, index));
	});
});

function writeMode () {
	previewButton.classList.remove('selected');
	writeButton.classList.add('selected');
	form.classList.add('write-selected');
}

function previewMode () {
	writeButton.classList.remove('selected');
	previewButton.classList.add('selected');
	form.classList.remove('write-selected');
	var content = textarea.value;
	preview.innerHTML = md.render(content);
	Array.prototype.forEach.call(preview.querySelectorAll('input[type=checkbox].task-list-item-checkbox'), function (input) {
		input.removeAttribute('disabled');
		input.addEventListener('change', function (e) {
			var inputText = input.parentNode.textContent.trim();
			var noteText = textarea.value;
			if (input.checked) {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[\\s\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[x]$2');
			} else {
				noteText = noteText.replace(new RegExp('(-\\s?)\\[x\\](\\s?' + RegExp.escape(inputText) + ')'), '$1[ ]$2');
			}
			textarea.value = noteText;
		});
	});
}

function saveNote () {
	var active = list.querySelector('.selected');
	var index = active.getAttribute('data-index');
	var note = notes[index];
	var content = textarea.value;
	var name = title.value;
	if (content === note.content && name === note.name) {
		console.log('nothing changed');
		return;
	}
	var updated = {};
	var url = endPoint;
	var method = postJson;
	if (content !== note.content) {
		updated.content = content;
	}
	if (name !== note.name) {
		updated.name = name;
	}
	if (!note.new) {
		url += '/' + encodeURIComponent(note.path);
		method = putJson;
	} else {

	}
	method(url, updated).then(function (resp) {
		if (note.new) {
			note.new = false;
			note.path = updated.name + '/index.md';
		}
		if (updated.name) {
			note.name = updated.name;
			note.path = updated.name + '/index.md';
		}
		note.content = updated.content;
		note.path = resp.path;
	}, function (err) {
		console.error(err);
	});
}

function showNote (li) {
	Array.prototype.forEach.call(li.parentNode.querySelectorAll('li'), function (li) {
		li.classList.remove('selected');
	});
	li.classList.add('selected');
	var index = li.getAttribute('data-index');
	var note = notes[index];
	textarea.value = note.content || '';
	title.value = note.name;
}

function newNote () {
	var note = {
		path: 'Untitled/index.md',
		name: 'Untitled',
		content: '',
		new: true
	};
	var li = createNoteLi(note, notes.push(note) - 1);
	list.appendChild(li);
	showNote(li);
	textarea.focus();
}

function createNoteLi (note, index) {
	var li = document.createElement('li');
	li.innerHTML = note.name;
	li.setAttribute('data-index', index);
	li.addEventListener('click', showNote.bind(window, li));
	return li;
}
