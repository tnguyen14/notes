var Promise = require('bluebird');
var async = require('async');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var google = require('googleapis');
var drive = google.drive('v3');
var OAuth2 = google.auth.OAuth2;
var cookieSession = require('cookie-session');
var passport = require('passport');

app.use(cookieSession({
	name: process.env.COOKIE_NAME,
	secret: process.env.COOKIE_SECRET,
	domain: process.env.COOKIE_DOMAIN
}));

app.use(passport.initialize());
app.use(passport.session());

var mimeTypes = {
	md: 'text/x-markdown',
	folder: 'application/vnd.google-apps.folder'
};
var rootDir, label, auth;

function isAuthenticated (req, res, next) {
	if (!req.isAuthenticated || !req.isAuthenticated) {
		return res.sendStatus(401);
	}
	if (!auth) {
		auth = new OAuth2();
		google.options({auth: auth});
	}
	// update Google credentials
	auth.credentials = {
		access_token: req.user.accessToken,
		refresh_token: req.user.refreshToken
	};
	return next();
}

app.use(bodyParser.json());

function getFileContent (fileId) {
	if (!fileId) {
		return;
	}
	return new Promise((resolve, reject) => {
		drive.files.get({
			auth: auth,
			fileId: fileId,
			alt: 'media'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp);
		});
	});
}

function getFolderChildren (folderId) {
	if (!folderId) {
		return;
	}
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			corpus: 'user',
			q: '\'' + folderId + '\'' + ' in parents'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}
/**
 * @param {Object} file
 * @param {String} file.id eg. '0B8Jsod-g6nz2ZWRzRjNqdzZVRE0a'
 * @param {String} file.name
 * @param {String} file.mimeType 'application/vnd.google-apps.folder' or
 * 'text/x-markdown'
 */
function processFile (file) {
	switch (file.mimeType) {
		case mimeTypes.md:
			let ext = path.extname(file.name);
			return getFileContent(file.id)
				.then((content) => {
					return {
						id: file.id,
						name: path.basename(file.name, ext),
						content: content
					};
				});
		case mimeTypes.folder:
			let indexMd;
			return getFolderChildren(file.id)
				.then((files) => {
					indexMd = files.find((f) => {
						return f.name === 'index.md';
					});
					if (!indexMd) {
						return;
					}
					return indexMd.id;
				})
				.then(getFileContent)
				.then((content) => {
					if (content) {
						return {
							name: file.name,
							id: indexMd.id,
							content: content
						};
					}
				});
	}
}

function findByName (name, callback) {
	drive.files.list({
		q: 'name contains \'' + name + '\' and trashed = false',
		fields: 'files(id,mimeType,name,parents)'
	}, (err, resp) => {
		if (err) {
			return callback(err);
		}
		callback(null, resp.files.filter((file) => {
			if (file.parents.indexOf(rootDir) === -1) {
				return false;
			}
			if (file.mimeType === mimeTypes.folder || file.mimeType === mimeTypes.md) {
				return true;
			}
		}));
	});
}

app.get('/', isAuthenticated, (req, res) => {
	drive.files.list({
		q: '\'' + rootDir + '\'' + ' in parents and trashed = false'
	}, (err, resp) => {
		if (err) {
			console.error(err);
			if (err.code === 401 || err.code === 403) {
				res.status(err.code);
			} else {
				res.status(400);
			}
			res.json(err);
			return;
		}
		Promise.all(resp.files.map(processFile))
			.then((notes) => {
				res.json({
					label: label,
					notes: notes.filter((n) => n)
				});
			}, (err) => {
				if (err) {
					console.error(err);
					res.status(400).json(err);
				}
			});
	});
});

app.put('/:id', function (req, res) {
	let params = {
		fileId: req.params.id,
		media: {
			body: req.body.content,
			mimeType: mimeTypes.md
		}
	};
	if (req.body.name) {
		params.resource = {
			name: req.body.name
		};
	}
	drive.files.update(params, (err, resp) => {
		if (err) {
			console.error(err);
			res.status(400).json(err);
			return;
		}
		res.json(resp);
	});
});

app.post('/', function (req, res) {
	async.waterfall([
		function (callback) {
			findByName(req.body.name, callback);
		},
		function (files, callback) {
			if (files.length > 0) {
				return callback(new Error('Note "' + req.body.name + '" already exists.'));
			}
			drive.files.create({
				resource: {
					name: req.body.name,
					mimeType: mimeTypes.folder,
					parents: [rootDir]
				}
			}, callback);
		},
		function (resp, body, callback) {
			drive.files.create({
				resource: {
					name: 'index.md',
					parents: [resp.id]
				},
				media: {
					body: req.body.content,
					mimeType: mimeTypes.md
				}
			}, callback);
		}
	], (err, resp) => {
		if (err) {
			if (err.message.indexOf('already exists') !== -1) {
				res.status(409);
			} else {
				res.status(400);
			}
			res.json({message: err.message});
			return;
		}
		res.json(resp);
	});
});

app.delete('/:id', function (req, res) {
	async.waterfall([
		function (callback) {
			drive.files.get({
				fileId: req.params.id,
				fields: 'name,parents'
			}, callback);
		},
		function (resp, body, callback) {
			let toDelete = req.params.id;
			if (resp.name === 'index.md') {
				toDelete = resp.parents[0];
			}
			drive.files.delete({
				fileId: toDelete
			}, callback);
		}
	], (err, resp) => {
		if (err) {
			console.error(err);
			res.status(400).json(err);
			return;
		}
		res.json('OK!');
	});
});

module.exports = function (endpoint) {
	rootDir = endpoint.rootDir;
	label = endpoint.label;
	return app;
};
