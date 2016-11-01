var Promise = require('bluebird');
var pick = require('lodash.pick');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var flatfile = require('flat-file-db');
var db = flatfile.sync('./data/users.db');
var debug = require('debug')('notes');

var cookieSession = require('cookie-session');
var api = require('./api');

var needle = require('needle');

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
	needle.get(process.env.AUTH_URL + '/profile', {
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

app.get('/me', isAuthenticated, (req, res) => {
	api.getDirs({
		rootDir: 'root',
		credentials: {
			access_token: req.user.accessToken,
			refresh_token: req.user.refreshToken
		}
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
	api.getDirs({
		rootDir: driveConfig.rootDir,
		credentials: {
			access_token: req.user.accessToken,
			refresh_token: req.user.refreshToken
		}
	}).then((files) => {
		Promise.all(files.map((file) => {
			return api.processFile({
				file: file,
				credentials: {
					access_token: req.user.accessToken,
					refresh_token: req.user.refreshToken
				}
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
		credentials: {
			access_token: req.user.accessToken,
			refresh_token: req.user.refreshToken
		}
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
		credentials: {
			access_token: req.user.accessToken,
			refresh_token: req.user.refreshToken
		}
	}).then((resp) => {
		res.json(resp);
	}, handleError.bind(null, res));
});

app.delete('/:id', isAuthenticated, function (req, res) {
	api.deleteNote({
		fileId: req.params.id,
		credentials: {
			access_token: req.user.accessToken,
			refresh_token: req.user.refreshToken
		}
	}).then((resp) => {
		res.json(resp);
	}, handleError.bind(null, res));
});

module.exports = function (endpoint) {
	return app;
};
