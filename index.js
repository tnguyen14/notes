var md = require('markdown-it')();
var previewButton = document.querySelector('.preview-button');
var textarea = document.querySelector('.write-content textarea');
var preview = document.querySelector('.preview-content .markdown-body');

previewButton.addEventListener('click', function (e) {
	// e.preventDefault();
	var content = textarea.value;
	preview.innerHTML = md.render(content);
});
