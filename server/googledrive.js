var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var mkdirp = Promise.promisify(require('mkdirp'));
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var google = require('googleapis');
var GoogleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/drive'];
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
		let googleAuth = new GoogleAuth();
		auth = new googleAuth.OAuth2(clientId, clientSecret, redirectUrl);
	}
	fs.accessAsync(TOKEN_PATH)
		.then(() => {
			return fs.readFileAsync(TOKEN_PATH);
		})
		.then((token) => {
			auth.credentials = JSON.parse(token);
			return next();
		}, () => {
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

app.get('/', isAuthenticated, (req, res) => {
	res.json({
		label: label,
		notes: []
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
