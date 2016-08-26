var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var notify = require('./notify');
var driveEndPoint = process.env.API_URL + '/drive';
var note = require('./note');
var signin = require('./signin');

var TYPE = 'drive';
function getNotes () {
	return getJson(driveEndPoint, {
		credentials: 'include'
	}).then(renderDriveNotes, function (err) {
		if (err.response.status === 401 || err.response.status === 403) {
			notify({
				type: 'blue',
				message: 'Redirecting to Google Drive for authorization',
				permanent: true
			});
			signin.authorize('https://www.googleapis.com/auth/drive');
		} else {
			notify({
				type: 'red',
				message: 'Error in getting Google Drive notes: ' + err.message,
				permanent: true
			});
		}
	});
}

function renderDriveNotes (response) {
	note.renderNotes({
		notes: response.notes,
		label: response.label,
		type: TYPE
	});
}

module.exports = {
	getNotes: getNotes
};
