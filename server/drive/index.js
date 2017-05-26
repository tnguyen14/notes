/* @flow */

const pick = require('lodash.pick');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const flatfile = require('flat-file-db');
const db = flatfile.sync('./data/users.db');
const debug = require('debug')('notes');
const path = require('path');

const cookieSession = require('cookie-session');
const api = require('./api');

const needle = require('needle');

const authUrl = process.env.AUTH_URL;
if (!authUrl) {
	throw new Error('No Auth URL.');
}

app.use(cookieSession({
	name: process.env.COOKIE_NAME,
	secret: process.env.COOKIE_SECRET,
	domain: process.env.COOKIE_DOMAIN
}));

app.use(bodyParser.json());

/* call the AUTH_URL to see if user is authenticated */
function isAuthenticated (req, res, next) {
	// pass along cookies from the client-side
	var cookies = {};
	cookies[req.sessionKey] = req.sessionCookies.get(req.sessionKey, req.sessionOptions);
	cookies[req.sessionKey + '.sig'] = req.sessionCookies.get(req.sessionKey + '.sig');
	needle.get(authUrl + '/profile', {
		cookies: cookies
	}, function (err, resp) {
		if (err) {
			console.error(err);
			return res.sendStatus(500);
		}
		if (resp.statusCode === 200) {
			req.user = resp.body;
			return next();
		}
		if (resp.statusCode === 401) {
			return res.sendStatus(401);
		}
	});
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

function handleError (res, err) {
	// google drive 401 error
	if (err.code === 401) {
		res.status(401);
	} else {
		// if resource already exists (used for POST call mostly)
		if (err.message.indexOf('already exists') !== -1) {
			res.status(409);
		} else {
			res.status(400);
		}
	}
	res.json(err);
}

function getCredentials (req) {
	if (!req.user) {
		throw new Error('No user found on request');
	}
	return {
		access_token: req.user.accessToken,
		refresh_token: req.user.refreshToken,
		// (milliseconds since Unix Epoch time) for 15 days
		expiry_date: (new Date()).getTime() + (1000 * 60 * 60 * 24 * 15)
	};
}

app.get('/me', isAuthenticated, (req, res) => {
	api.getDirs({
		rootDir: 'root',
		credentials: getCredentials(req)
	}).then((rootDirs) => {
		res.json(Object.assign({}, db.get(req.user.id), {
			rootDirs: rootDirs
		}));
	}, handleError.bind(null, res));
});

app.patch('/me', isAuthenticated, (req, res) => {
	var driveConfig = db.get(req.user.id);
	var newConfig = pick(req.body, ['rootDir', 'label']);
	db.put(req.user.id, Object.assign({}, driveConfig, newConfig));
	res.status(200).json(db.get(req.user.id));
});

/*
 * Get all markdown files and dirs under rot dir
 * For each direct markdown file, add to `notes`
 * For each directory, combine into a list of directories to process
 * Then get all markdown files that are children of all those directories
 * For each index.md file, add its properties and its parent's name to `notes`
 */
app.get('/', isAuthenticated, hasRootDir, (req, res) => {
	var driveConfig = db.get(req.user.id);
	api.getDirsAndFiles({
		rootDir: driveConfig.rootDir,
		credentials: getCredentials(req)
	}).then((files) => {
		let notes = [];
		let folders = [];
		files.forEach((file) => {
			let ext = path.extname(file.name);
			if (file.mimeType === api.mimeTypes.md) {
				notes.push(Object.assign({}, api.pickFileProperties(file), {
					name: path.basename(file.name, ext)
				}));
			} else if (file.mimeType === api.mimeTypes.folder) {
				folders.push(file);
			}
		});
		api.getMarkdownFilesInFolders({
			credentials: getCredentials(req),
			folders: folders.map((folder) => folder.id)
		}).then((secondaryFiles) => {
			// only care about index.md files for now
			secondaryFiles.forEach((secondaryFile) => {
				if (secondaryFile.name !== 'index.md') {
					return;
				}
				let parentFolder = folders.find((f) => {
					return f.id === secondaryFile.parents[0];
				});
				notes.push(Object.assign({}, api.pickFileProperties(secondaryFile), {
					name: parentFolder.name
				}));
			});
			res.json(notes.filter((n) => n).map((n) => {
				return Object.assign({}, n, {
					// add userId and type to each note
					userId: req.user.id,
					type: 'drive'
				});
			}));
		}, (err) => {
			if (err) {
				debug(err);
				debug(err.message);
				res.status(400).json({
					message: err.message
				});
			}
		});
	}, handleError.bind(null, res));
});

// get file contents
// @TODO: should this return the file metadata as well?
app.get('/:id', isAuthenticated, function (req, res) {
	api.getFileContent({
		fileId: req.params.id,
		credentials: getCredentials(req)
	}).then((resp) => {
		res.json({
			content: resp
		});
	}, handleError.bind(null, res));
});

app.put('/:id', isAuthenticated, function (req, res) {
	api.updateNote({
		fileId: req.params.id,
		content: req.body.content,
		name: req.body.name,
		credentials: getCredentials(req)
	}).then((resp) => {
		res.json(resp);
	}, handleError.bind(null, res));
});

app.post('/', isAuthenticated, hasRootDir, function (req, res) {
	var driveConfig = db.get(req.user.id);
	api.createNote({
		name: req.body.name,
		rootDir: driveConfig.rootDir,
		content: req.body.content,
		useFile: true,
		credentials: getCredentials(req)
	}).then((resp) => {
		res.json(Object.assign(resp, {
			userId: req.user.id,
			type: 'drive'
		}));
	}, handleError.bind(null, res));
});

app.delete('/:id', isAuthenticated, function (req, res) {
	api.deleteNote({
		fileId: req.params.id,
		credentials: getCredentials(req)
	}).then((resp) => {
		res.json(resp);
	}, handleError.bind(null, res));
});

module.exports = function () {
	return app;
};
