var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var rimraf = Promise.promisify(require('rimraf'));
var path = require('path');
var userHome = require('user-home');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var notesDir = userHome + '/Dropbox/Notes/';

/**
 * @param {Object} file
 * @param {String} file.path
 * @returns {Promise}
 */
function processFile (file) {
	return fs.accessAsync(notesDir + file.path).then(() => {
		return fs.readFileAsync(notesDir + file.path, 'utf8')
			.then((data) => {
				return Object.assign({}, file, {
					content: data
				});
			});
	}, (err) => {
		console.error(err);
	});
}

app.use(bodyParser.json());

app.get('/api/notes', function (req, res) {
	fs.readdirAsync(notesDir)
		.then(function (files) {
			return Promise.all(files.map((f) => {
				return fs.statAsync(notesDir + f)
					.then((stat) => {
						if (stat.isDirectory()) {
							return processFile({
								path: f + '/index.md',
								name: f
							});
						}
						if (stat.isFile()) {
							var ext = path.extname(f);
							if (ext === '.md') {
								return processFile({
									path: f,
									name: path.basename(f, ext)
								});
							}
						}
					});
			}));
		}).then((notes) => {
			res.json(notes.filter((n) => n));
		}, (err) => {
			console.error(err);
			res.status(400).json(err);
		});
});

app.put('/api/notes/:path', function (req, res) {
	var filePath = decodeURIComponent(req.params.path);
	var content = req.body.content;
	var newName;
	if (req.body.name) {
		newName = req.body.name;
	}
	fs.accessAsync(notesDir + filePath)
		.then(() => {
			if (!newName) {
				return fs.writeFileAsync(notesDir + filePath, content);
			}
			return newNote(newName, content)
				.then(() => {
					return removeNote(filePath);
				});
		})
		.then(() => {
			res.status(200).json('OK!');
		}, (err) => {
			console.error(err);
			res.status(400).json(err);
		});
});

function newNote (name, content) {
	return Promise.any([fs.accessAsync(notesDir + name),
		fs.accessAsync(notesDir + name + '.md')])
		.then(() => {
			throw new Error('Note ' + name + ' already exists.');
		}, () => {
			return fs.mkdirAsync(notesDir + name);
		}).then(() => {
			return fs.writeFileAsync(notesDir + name + '/index.md', content);
		});
}

app.post('/api/notes', function (req, res) {
	var name = req.body.name;
	var content = req.body.content;
	newNote(name, content).then(() => {
		res.status(200).json('OK!');
	}, (err) => {
		console.error(err);
		if (err.message.indexOf('already exists') !== -1) {
			res.status(409);
		} else {
			res.status(400);
		}
		res.json(err);
	});
});

function removeNote (filePath) {
	var dirToRemove = filePath;
	if (path.dirname(filePath) !== '.') {
		dirToRemove = path.dirname(filePath);
	}
	return rimraf(notesDir + dirToRemove);
}

app.delete('/api/notes/:path', function (req, res) {
	var filePath = decodeURIComponent(req.params.path);
	fs.accessAsync(notesDir + filePath)
		.then(() => {
			return removeNote(filePath);
		})
		.then(() => {
			res.status(200).json('OK!');
		}, (err) => {
			console.error(err);
			res.status(400).json(err);
		});
});

app.use(express.static('dist'));
app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

