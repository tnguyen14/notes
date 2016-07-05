var md = require('markdown-it')()
	.use(require('markdown-it-task-lists'));
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var putJson = simpleFetch.putJson;

var previewButton = document.querySelector('.preview-button');
var writeButton = document.querySelector('.write-button');
var textarea = document.querySelector('.write-content textarea');
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

getJson('/api/notes').then(function (_notes) {
	notes = _notes;
	notes.forEach(function (note, index) {
		var li = document.createElement('li');
		li.innerHTML = note.name;
		li.setAttribute('data-index', index);
		li.setAttribute('data-path', note.path);
		li.addEventListener('click', showNote);
		list.appendChild(li);
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
	var path = active.getAttribute('data-path');
	var content = textarea.value;
	if (content === notes[index].data) {
		console.log('nothing changed');
		return;
	}
	putJson('/api/notes/' + encodeURIComponent(path), {
		data: content
	}).then(function () {
		notes[index].data = content;
	});
}

function showNote (e) {
	var li = e.target;
	Array.prototype.forEach.call(li.parentNode.querySelectorAll('li'), function (li) {
		li.classList.remove('selected');
	});
	li.classList.add('selected');
	var index = li.getAttribute('data-index');
	var data = notes[index].data;
	textarea.value = data;
}
