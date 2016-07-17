require('dotenv-safe').load();
var express = require('express');
var app = express();
var cors = require('cors');
var config = require('../config.json');
var local = require('./local');
var drive = require('./drive');

var authorizedOrigins = process.env.AUTHORIZED_ORIGINS.split(',');
app.use(cors({
	origin: function (origin, callback) {
		callback(null, authorizedOrigins.indexOf(origin) !== -1);
	}
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

app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

