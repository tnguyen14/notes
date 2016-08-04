var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var signIn = document.querySelector('.sign-in');
var signInButton = signIn.querySelector('button');

module.exports = function signin () {
	return getJson(process.env.AUTH_URL + '/profile', {
		credentials: 'include'
	})
		.catch(function (err) {
			if (err.response.status === 401) {
				signIn.showModal();
			}
			throw err;
		});
};

signInButton.addEventListener('click', function () {
	var currentUrl = window.location.href;
	window.location = process.env.AUTH_URL + '/login/google' + '?redirect=' + encodeURIComponent(currentUrl);
});
