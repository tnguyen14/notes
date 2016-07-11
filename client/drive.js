var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var postJson = simpleFetch.postJson;
var notify = require('./notify');
var driveEndPoint = '/api/drive';

function getDriveNotes () {
	return getJson(driveEndPoint).then(renderDriveNotes, function (err) {
		if (err.response.status === 401) {
			notify({
				type: 'blue',
				message: 'Redirecting to Google Drive for authorization',
				permanent: true
			});
			err.response.json()
			.then(function (json) {
				window.location = json.url;
			});
		} else {
			notify({
				type: 'red',
				message: 'Error in getting Google Drive notes: ' + err.message,
				permanent: true
			});
		}
	});
}

function submitDriveAuth (code) {
	notify({
		type: 'blue',
		message: 'Authorizing with Google Drive',
		permanent: true
	});
	if (!code) {
		// @TODO handle error
		notify({
			message: 'Code is missing',
			type: 'red'
		});
		return;
	}
	return postJson(driveEndPoint + '/auth', {
		code: code
	}).then(function () {
		window.history.replaceState(null, null, window.location.origin + window.location.pathname);
		notify({
			type: 'green',
			message: 'Successfully authorized with Google Drive',
			timeout: 3000
		});
		return getDriveNotes();
	}, (err) => {
		notify({
			type: 'red',
			message: err,
			permanent: true
		});
		console.error(err);
	});
}

function renderDriveNotes (response) {
	console.log(response);
}

module.exports = {
	getDriveNotes: getDriveNotes,
	submitDriveAuth: submitDriveAuth
};
