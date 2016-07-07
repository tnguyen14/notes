var md = require('markdown-it')()
	.use(require('markdown-it-task-lists'));
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var putJson = simpleFetch.putJson;
var deleteJson = simpleFetch.deleteJson;
var localEndPoint = '/api/local';

var viewButton = document.querySelector('.view-button');
var writeButton = document.querySelector('.write-button');
var textarea = document.querySelector('.write-content textarea');
var title = document.querySelector('.title');
var view = document.querySelector('.view-content .markdown-body');
var localList = document.querySelector('.list .local ul');
var form = document.querySelector('form');
var deleteConfirm = document.querySelector('dialog.delete-confirm');
var notification = document.querySelector('.notification');

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
			viewMode();
		} else {
			writeMode();
		}
	});
});

document.querySelector('.save').addEventListener('click', saveNote);
document.querySelector('.add').addEventListener('click', newNote);
document.querySelector('.remove').addEventListener('click', function () {
	deleteConfirm.showModal();
});
deleteConfirm.querySelector('.confirm').addEventListener('click', removeNote);
deleteConfirm.querySelector('.cancel').addEventListener('click', function () {
	deleteConfirm.close();
});
authDialog.querySelector('.auth-submit').addEventListener('click', submitDriveAuth);

// notification stuff
var notificationTimeoutId;
var notificationMessage = notification.querySelector('.message');
notification.querySelector('.close').addEventListener('click', hideNotification);
function showNotification () {
	notification.classList.add('active');
}
function hideNotification () {
	notification.classList.remove('active');
	clearNotification();
}
function clearNotification () {
	notificationMessage.innerHTML = '';
	notification.setAttribute('data-type', '');
}
function notify (opts) {
	if (!opts || !Object.keys(opts).length) {
		return;
	}

	if (notification.classList.contains('active')) {
		clearNotification();
		clearTimeout(notificationTimeoutId);
	}

	if (opts.message) {
		notificationMessage.innerHTML = opts.message;
	}
	if (opts.type) {
		notification.setAttribute('data-type', opts.type);
	}
	showNotification();
	// auto dismiss after 10s
	var timeout = opts.timeout || 2000;
	if (!opts.permanent) {
		notificationTimeoutId = setTimeout(hideNotification, timeout);
	}
}

getLocalNotes().then(function () {
	// return getDriveNotes();
});

function getLocalNotes () {
	return getJson(localEndPoint).then(function (response) {
		notes = response.notes;
		notes.forEach(function (note, index) {
			var li = createNoteLi(note, index);
			localList.parentNode.querySelector('h3').innerHTML = response.label;
			localList.appendChild(li);
			if (index === 0) {
				showNote(li);
			}
		});
	});
}

function writeMode () {
	viewButton.classList.remove('selected');
	writeButton.classList.add('selected');
	form.classList.add('write-selected');
}

function viewMode () {
	writeButton.classList.remove('selected');
	viewButton.classList.add('selected');
	form.classList.remove('write-selected');
	var content = textarea.value;
	view.innerHTML = md.render(content);
	Array.prototype.forEach.call(view.querySelectorAll('input[type=checkbox].task-list-item-checkbox'), function (input) {
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
	var active = localList.querySelector('.selected');
	var index = active.getAttribute('data-index');
	var note = notes[index];
	var content = textarea.value;
	var name = title.value;
	if (content === note.content && name === note.name) {
		notify({
			type: 'blue',
			message: 'No new change detected.'
		});
		return;
	}
	var updated = {};
	var url = localEndPoint;
	var method = postJson;
	if (content !== note.content) {
		updated.content = content;
	}
	if (!note.new) {
		url += '/' + encodeURIComponent(note.path);
		method = putJson;
		if (name !== note.name) {
			updated.name = name;
		}
	} else {
		updated.name = name;
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
		viewMode();
	}, function (err) {
		notify({
			message: err,
			type: 'red'
		});
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
	viewMode();
}

function newNote () {
	var note = {
		path: 'Untitled/index.md',
		name: 'Untitled',
		content: '',
		new: true
	};
	var li = createNoteLi(note, notes.push(note) - 1);
	localList.appendChild(li);
	showNote(li);
	writeMode();
	textarea.focus();
}

function createNoteLi (note, index) {
	var li = document.createElement('li');
	li.innerHTML = note.name;
	li.setAttribute('data-index', index);
	li.addEventListener('click', showNote.bind(window, li));
	return li;
}

function removeNote () {
	var active = localList.querySelector('.selected');
	if (!active) {
		return;
	}
	var index = active.getAttribute('data-index');
	var note = notes[index];
	deleteConfirm.close();
	deleteJson(localEndPoint + '/' + encodeURIComponent(note.path))
		.then(function () {
			// @TODO this should be rewritten to completely remove note
			// and update DOM elements
			note.deleted = true;
			localList.querySelector('li:nth-of-type(' + (Number(index) + 1) + ')').style.display = 'none';
			textarea.value = '';
			title.value = '';
		});
}
