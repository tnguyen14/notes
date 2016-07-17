var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var note = require('./note');

var endPoint = '/api/local';
var TYPE = 'local';

function getNotes () {
	return getJson(endPoint).then(function (response) {
		note.renderNotes({
			notes: response.notes,
			label: response.label,
			type: TYPE
		});
	});
}

module.exports = {
	getNotes: getNotes
};
