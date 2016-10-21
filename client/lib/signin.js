var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var signIn = document.querySelector('.sign-in');
var signInButton = signIn.querySelector('button');
var notify = require('./notify');

module.exports.authorize = authorize;
module.exports.getProfile = getProfile;

function getProfile () {
	return getJson(process.env.AUTH_URL + '/profile', {
		credentials: 'include'
	})
		.catch(function (err) {
			if (err.response.status === 401) {
				signIn.showModal();
			}
			throw err;
		});
}

signInButton.addEventListener('click', function (e) {
	e.preventDefault();
	authorize();
});

function authorize (scopes) {
	// default scope is just profile
	var scope = ['profile', 'https://www.googleapis.com/auth/drive'];
	if (scopes) {
		scope = scope.concat(scopes);
	}
	var currentUrl = window.location.href;
	notify({
		type: 'blue',
		message: 'Logging in Google Drive...',
		permanent: true
	});
	window.location = process.env.API_URL + '/auth/login/google' + '?scope=' + encodeURIComponent(scope.join(' ')) + '&redirect=' + encodeURIComponent(currentUrl);
}

