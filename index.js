var md = require('markdown-it')();
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;

var previewButton = document.querySelector('.preview-button');
var textarea = document.querySelector('.write-content textarea');
var preview = document.querySelector('.preview-content .markdown-body');
var list = document.querySelector('.list ul');

var notes;

previewButton.addEventListener('click', function () {
	var content = textarea.value;
	preview.innerHTML = md.render(content);
});

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
