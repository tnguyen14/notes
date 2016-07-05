var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var userHome = require('user-home');
var express = require('express');
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
					data: data
				});
			});
	}, (err) => {
		console.error(err);
	});
}

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
							if (ext === '.md' || ext === '.markdown') {
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
			res.status(400).send(err);
		});
});

app.use(express.static('dist'));
app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

