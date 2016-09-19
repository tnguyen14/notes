var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var notify = require('./notify');
var driveEndPoint = process.env.API_URL + '/drive';
var note = require('./note');
var signin = require('./signin');
var config = require('./config');

var TYPE = 'drive';
function getNotes () {
	return getJson(driveEndPoint, {
		credentials: 'include'
	}).then(renderDriveNotes, (err) => {
		if (err.response.status === 401) {
			notify({
				type: 'blue',
				message: 'Redirecting to Google Drive for authorization',
				permanent: true
			});
			signin.authorize('https://www.googleapis.com/auth/drive');
		} else {
			return err.response.json().then((error) => {
				notify({
					type: 'red',
					message: 'Error in getting Google Drive notes: ' + error.message,
					permanent: true
				});
				if (error.message.startsWith('Configuration:')) {
					config.open(() => {
						notify.clear();
						getNotes();
					});
				}
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
