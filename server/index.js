require('dotenv-safe').load();
var express = require('express');
var app = express();
var cors = require('cors');
var config = require('../config.json');
var auth = require('@tridnguyen/auth');
var local = require('./local');
var drive = require('./drive');

var authorizedOrigins = process.env.AUTHORIZED_ORIGINS.split(',');
app.use(cors({
	origin: function (origin, callback) {
		callback(null, authorizedOrigins.indexOf(origin) !== -1);
	},
	credentials: true
}));

config.endpoints.forEach((endpoint) => {
	let module;
	if (endpoint.type === 'local') {
		module = local;
	}
	if (endpoint.type === 'google-drive') {
		module = drive;
	}
	app.use('/' + endpoint.uri, module(endpoint));
});
app.use('/auth', auth({
	cors: true
}));

app.listen(process.env.PORT || 3000, function () {
	console.log('Express is listening.');
});

