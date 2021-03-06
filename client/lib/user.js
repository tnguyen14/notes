var dialogPolyfill = require('dialog-polyfill');
var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var signIn = document.querySelector('.sign-in');
var signInButton = signIn.querySelector('button');
var notify = require('./notify');

module.exports.authorize = authorize;
module.exports.getProfile = getProfile;
module.exports.logoutUrl = process.env.AUTH_URL + '/logout?redirect=' +
	encodeURIComponent(process.env.CLIENT_URL);

// polyfill dialog
dialogPolyfill.registerDialog(signIn);

function getProfile () {
	return getJson(process.env.AUTH_URL + '/profile', {
		credentials: 'include'
	})
		.catch(function (err) {
			if (err.response && err.response.status === 401) {
				signIn.showModal();
			} else {
				notify({
					type: 'red',
					message: 'Unable to connect to the auth service: ' + err.message,
					permanent: true
				});
			}
			throw err;
		});
}

signInButton.addEventListener('click', function (e) {
	e.preventDefault();
	authorize();
});

function authorize (redirect) {
	// default scope is just profile
	var scope = ['profile', 'https://www.googleapis.com/auth/drive'];
	var redirectUrl = redirect || window.location.href;
	notify({
		type: 'blue',
		message: 'Logging in Google Drive...',
		permanent: true
	});
	window.location = `${process.env.AUTH_URL}/login/google?scope=${encodeURIComponent(scope.join(' '))}&redirect=${encodeURIComponent(redirectUrl)}`;
}
