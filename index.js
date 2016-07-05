var md = require('markdown-it')();
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;

var previewButton = document.querySelector('.preview-button');
var textarea = document.querySelector('.write-content textarea');
var preview = document.querySelector('.preview-content .markdown-body');
var list = document.querySelector('.list');

previewButton.addEventListener('click', function () {
	var content = textarea.value;
	preview.innerHTML = md.render(content);
});

getJson('/api/notes').then(function (notes) {
	console.log(notes);
	notes.forEach(function (note) {
		var li = document.createElement('li');
		li.innerHTML = note.name;
		list.appendChild(li);
	});
});
