/* @flow */

const Promise = require('bluebird');
const pick = require('lodash.pick');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const flatfile = require('flat-file-db');
const db = flatfile.sync('./data/users.db');
const debug = require('debug')('notes');

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

app.get('/', isAuthenticated, hasRootDir, (req, res) => {
	var driveConfig = db.get(req.user.id);
	api.getDirsAndFiles({
		rootDir: driveConfig.rootDir,
		credentials: getCredentials(req)
	}).then((files) => {
		Promise.all(files.map((file) => {
			return api.processFile({
				file: file,
				credentials: getCredentials(req)
			}).catch((err) => {
				debug(err);
				return;
			});
		})).then((notes) => {
			res.json(notes.filter((n) => n).map((n) => {
				// add userId and type to each note
				n.userId = req.user.id;
				n.type = 'drive';
				return n;
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
