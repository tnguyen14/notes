var express = require('express');
var app = express();

app.use('/api/local', require('./local'));

app.use(express.static('dist'));
app.use(express.static('public'));

app.listen(process.env.PORT || 4002, function () {
	console.log('Express is listening.');
});

