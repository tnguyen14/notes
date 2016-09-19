var Promise = require('bluebird');
var pick = require('lodash.pick');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var flatfile = require('flat-file-db');
var db = flatfile.sync('./data/users.db');

var cookieSession = require('cookie-session');
var passport = require('passport');
var api = require('./api');

app.use(cookieSession({
	name: process.env.COOKIE_NAME,
	secret: process.env.COOKIE_SECRET,
	domain: process.env.COOKIE_DOMAIN
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());

function isAuthenticated (req, res, next) {
	if (!req.isAuthenticated || !req.isAuthenticated) {
		return res.sendStatus(401);
	}
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

app.get('/me', isAuthenticated, (req, res) => {
	api.getDirs({
		rootDir: 'root',
		accessToken: req.user.accessToken
	}).then((rootDirs) => {
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
	api.getDirs({
		rootDir: driveConfig.rootDir,
		accessToken: req.user.accessToken
	}).then((files) => {
		Promise.all(files.map((file) => {
			return api.processFile({
				file: file,
				accessToken: req.user.accessToken
			});
		})).then((notes) => {
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
	api.updateNote({
		fileId: req.params.id,
		content: req.body.content,
		name: req.body.name,
		accessToken: req.user.accessToken
	}).then((resp) => {
		res.json(resp);
	}, (err) => {
		res.status(400).json(err);
	});
});

app.post('/', isAuthenticated, hasRootDir, function (req, res) {
	var driveConfig = db.get(req.user.id);
	api.createNote({
		name: req.body.name,
		rootDir: driveConfig.rootDir,
		content: req.body.content,
		accessToken: req.user.accessToken
	}).then((resp) => {
		res.json(resp);
	}, (err) => {
		if (err.message.indexOf('already exists') !== -1) {
			res.status(409);
		} else {
			res.status(400);
		}
		res.json(err);
	});
});

app.delete('/:id', function (req, res) {
	api.deleteNote({
		fileId: req.params.id,
		accessToken: req.user.accessToken
	}).then((resp) => {
		res.json(resp);
	}, (err) => {
		res.status(400).json(err);
	});
});

module.exports = function (endpoint) {
	return app;
};
