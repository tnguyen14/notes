var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var rimraf = Promise.promisify(require('rimraf'));
var path = require('path');
var userHome = require('user-home');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var localDir;

/**
 * @param {Object} file
 * @param {String} file.path
 * @returns {Promise}
 */
function processFile (file) {
	var filePath = path.resolve(localDir, file.path);
	return fs.accessAsync(filePath).then(() => {
		return fs.readFileAsync(filePath, 'utf8')
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

app.get('/', function (req, res) {
	fs.readdirAsync(localDir)
		.then(function (files) {
			return Promise.all(files.map((f) => {
				return fs.statAsync(path.resolve(localDir, f))
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

app.put('/:path', function (req, res) {
	var filePath = path.resolve(localDir, decodeURIComponent(req.params.path));
	var content = req.body.content;
	var newName;
	if (req.body.name) {
		newName = req.body.name;
	}
	fs.accessAsync(filePath)
		.then(() => {
			if (!newName) {
				return fs.writeFileAsync(filePath, content);
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
	var dirPath = path.resolve(localDir, name);
	return Promise.any([fs.accessAsync(dirPath),
		fs.accessAsync(dirPath + '.md')])
		.then(() => {
			throw new Error('Note ' + name + ' already exists.');
		}, () => {
			return fs.mkdirAsync(dirPath);
		}).then(() => {
			return fs.writeFileAsync(dirPath + '/index.md', content);
		});
}

app.post('/', function (req, res) {
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
	if (path.dirname(path.relative(localDir, filePath)) !== '.') {
		dirToRemove = path.dirname(filePath);
	}
	return rimraf(dirToRemove);
}

app.delete('/:path', function (req, res) {
	var filePath = path.resolve(localDir, decodeURIComponent(req.params.path));
	fs.accessAsync(filePath)
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

module.exports = function (opts) {
	localDir = opts.rootDir.replace('~', userHome);
	return app;
};
