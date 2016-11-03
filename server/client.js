var path = require('path');
var express = require('express');
var app = express();

app.use(express.static('public'));

app.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(process.env.PORT || 3000, function () {
	console.log('Client express is listening.');
});
