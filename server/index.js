require('dotenv-safe').load();
var express = require('express');
var app = express();
var config = require('../config.json');
var local = require('./local');
var drive = require('./drive');

config.endpoints.forEach((endpoint) => {
	let module;
	if (endpoint.type === 'local') {
		module = local;
	}
	if (endpoint.type === 'google-drive') {
		module = drive;
	}
	app.use('/api/' + endpoint.uri, module(endpoint));
});

app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

