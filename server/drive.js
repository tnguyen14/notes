var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var mkdirp = Promise.promisify(require('mkdirp'));
var async = require('async');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var google = require('googleapis');
var drive = google.drive('v3');
var OAuth2 = google.auth.OAuth2;

var SCOPES = ['https://www.googleapis.com/auth/drive'];
var mimeTypes = {
	md: 'text/x-markdown',
	folder: 'application/vnd.google-apps.folder'
};
var TOKEN_DIR = 'private/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'notes.json';
var rootDir, label, clientCredentials, auth;

function isAuthenticated (req, res, next) {
	if (!clientCredentials) {
		console.error('No app credentails found.');
		res.status(400).json('No app credentials found.');
		return;
	}
	if (auth && Object.keys(auth.credentials).length) {
		return next();
	}
	if (!auth) {
		let clientSecret = clientCredentials.web.client_secret;
		let clientId = clientCredentials.web.client_id;
		let redirectUrl;
		if (process.env.NODE_ENV === 'development') {
			redirectUrl = clientCredentials.web.redirect_uris[1];
		} else if (process.env.NODE_ENV === 'production') {
			redirectUrl = clientCredentials.web.redirect_uris[0];
		}
		auth = new OAuth2(clientId, clientSecret, redirectUrl);
		google.options({auth: auth});
	}
	fs.accessAsync(TOKEN_PATH)
		.then(() => {
			return fs.readFileAsync(TOKEN_PATH);
		})
		.then((token) => {
			var existingToken = JSON.parse(token);
			// expired token
			if (existingToken.expiry_date < new Date().getTime()) {
				throw new Error('Token is expired.');
			}
			auth.credentials = existingToken;
			return next();
		}).catch((err) => {
			console.error(err);
			const authUrl = auth.generateAuthUrl({
				access_type: 'offline',
				scope: SCOPES
			});
			res.status(401).json({
				message: 'No token found. Please visit the provided URL to authorize the app and submit the code from that page to the /auth endpoint as a query parameter named "code".',
				url: authUrl
			});
		});
}

app.use(bodyParser.json());
// Load client secrets from a local file.
fs.accessAsync('private/client_secret.json')
	.then(() => {
		fs.readFileAsync('private/client_secret.json')
			.then((content) => {
				clientCredentials = JSON.parse(content);
			});
	}, (err) => {
		console.error('Error loading client secret file: ' + err);
		process.exit(1);
	});

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

app.get('/', isAuthenticated, (req, res) => {
	drive.files.list({
		corpus: 'user',
		q: '\'' + rootDir + '\'' + ' in parents'
	}, (err, resp) => {
		if (err) {
			console.error(err);
			res.status(400).json(err);
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
			console.error(err);
			res.status(400).json(err);
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

app.post('/auth', function (req, res) {
	if (!clientCredentials) {
		console.error('No app credentails found.');
		res.status(400).json('No app credentials found.');
		return;
	}
	if (!auth) {
		console.error('No auth instance found.');
		res.status(400).json('No auth instance found.');
		return;
	}
	return new Promise((resolve, reject) => {
		if (Object.keys(auth.credentials).length) {
			return resolve();
		}
		auth.getToken(req.body.code, (err, token) => {
			if (err) {
				console.error(err);
				return reject(err);
			}
			auth.credentials = token;
			// store token
			mkdirp(TOKEN_DIR)
				.then(() => {
					return fs.writeFileAsync(TOKEN_PATH, JSON.stringify(token));
				})
				.then(function () {
					resolve();
				});
		});
	}).then(() => {
		if (req.body.redirectUrl) {
			res.redirect(req.body.redirectUrl);
		} else {
			res.json('OK!');
		}
	}, (err) => {
		console.error('Error while retrieving access token', err);
		res.status(400).json('Error while retrieving access token.');
	});
});

module.exports = function (endpoint) {
	rootDir = endpoint.rootDir;
	label = endpoint.label;
	return app;
};
