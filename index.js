var md = require('markdown-it')();
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;

var previewButton = document.querySelector('.preview-button');
var writeButton = document.querySelector('.write-button');
var textarea = document.querySelector('.write-content textarea');
var preview = document.querySelector('.preview-content .markdown-body');
var list = document.querySelector('.list ul');
var form = document.querySelector('form');

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
}

getJson('/api/notes').then(function (_notes) {
	notes = _notes;
	notes.forEach(function (note, index) {
		var li = document.createElement('li');
		li.innerHTML = note.name;
		li.setAttribute('data-index', index);
		li.addEventListener('click', showNote);
		list.appendChild(li);
	});
});

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
