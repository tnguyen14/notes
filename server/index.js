require('dotenv-safe').load();
var express = require('express');
var app = express();
var config = require('../config.json');
var local = require('./local');

config.endpoints.forEach((endpoint) => {
	if (endpoint.type === 'local') {
		app.use('/api/' + endpoint.path, local(endpoint));
	}
});
app.use('/api/local', require('./local'));

app.use(express.static('dist'));
app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

