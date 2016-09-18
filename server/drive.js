var Promise = require('bluebird');
var async = require('async');
var path = require('path');
var pick = require('lodash.pick');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var flatfile = require('flat-file-db');
var db = flatfile.sync('./data/users.db');

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
app.use(bodyParser.json());

var mimeTypes = {
	md: 'text/x-markdown',
	folder: 'application/vnd.google-apps.folder'
};
var auth;

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

function hasRootDir (req, res, next) {
	if (!db.has(req.user.id)) {
		db.put(req.user.id, {
			type: 'google-drive',
			label: 'Google Drive'
		});
	}
	if (!db.get(req.user.id).rootDir) {
		return res.status(400).json({
			message: 'Configuration: No root dir defined for current user.'
		});
	}
	return next();
}

function getDirs (rootDir) {
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: `mimeType = '${mimeTypes.folder}' and '${rootDir}' in parents and trashed = false`
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

function findByName (name, rootDir, callback) {
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

app.get('/me', isAuthenticated, (req, res) => {
	getDirs('root').then((rootDirs) => {
		res.json(Object.assign(db.get(req.user.id), {
			rootDirs: rootDirs
		}));
	}, (err) => {
		res.status(err.code);
		res.json(err);
	});
});

app.patch('/me', isAuthenticated, (req, res) => {
	var driveConfig = db.get(req.user.id);
	var newConfig = pick(req.body, ['rootDir', 'label']);
	db.put(req.user.id, Object.assign({}, driveConfig, newConfig));
	res.sendStatus(200);
});

app.get('/', isAuthenticated, hasRootDir, (req, res) => {
	var driveConfig = db.get(req.user.id);
	getDirs(driveConfig.rootDir).then((files) => {
		Promise.all(files.map(processFile))
			.then((notes) => {
				res.json({
					label: driveConfig.label,
					notes: notes.filter((n) => n)
				});
			}, (err) => {
				if (err) {
					console.error(err);
					res.status(400).json(err);
				}
			});
	}, (err) => {
		res.status(err.code);
		res.json(err);
		return;
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

app.post('/', isAuthenticated, hasRootDir, function (req, res) {
	var driveConfig = db.get(req.user.id);
	async.waterfall([
		function (callback) {
			findByName(req.body.name, driveConfig.rootDir, callback);
		},
		function (files, callback) {
			if (files.length > 0) {
				return callback(new Error('Note "' + req.body.name + '" already exists.'));
			}
			drive.files.create({
				resource: {
					name: req.body.name,
					mimeType: mimeTypes.folder,
					parents: [req.user.rootDir]
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
	return app;
};
