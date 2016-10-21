var simpleFetch = require('simple-fetch');
var getJson = simpleFetch.getJson;
var patchJson = simpleFetch.patchJson;
var notify = require('./lib/notify');
var user = require('./lib/user');
var configUrl = process.env.API_URL + '/drive/me';
var configEl = document.querySelector('.configuration');
var saveButton = configEl.querySelector('button[type=submit]');
var labelInput = configEl.querySelector('input[name=label]');
var rootDirSelect = configEl.querySelector('select[name=rootdir]');
var originalConfig = {
	rootDir: rootDirSelect.value,
	label: labelInput.value
};
var callback;

module.exports.open = open;

saveButton.addEventListener('click', function (e) {
	e.preventDefault();
	var newConfig = {};
	if (labelInput.value !== originalConfig.label) {
		newConfig.label = labelInput.value;
	}
	if (rootDirSelect.value !== originalConfig.rootDir) {
		newConfig.rootDir = rootDirSelect.value;
	}
	saveButton.setAttribute('disabled', 'disabled');
	saveButton.innerText = 'Saving...';
	patchJson(configUrl, newConfig, {
		credentials: 'include'
	}).then(() => {
		saveButton.removeAttribute('disabled');
		saveButton.innerText = 'Save';
		configEl.close();
		if (callback) {
			callback();
		}
	}, (err) => {
		saveButton.removeAttribute('disabled');
		saveButton.innerText = 'Save';
		configEl.close();
		notify({
			type: 'red',
			message: 'Error saving configuration: ' + err.message,
			permanent: true
		});
	});
});

function open (cb) {
	callback = cb;
	return getJson(configUrl, {
		credentials: 'include'
	}).then((config) => {
		originalConfig = config;
		labelInput.value = config.label;
		rootDirSelect.innerHTML = '';
		config.rootDirs.forEach((dir) => {
			var option = document.createElement('option');
			option.innerText = dir.name;
			option.value = dir.id;
			rootDirSelect.appendChild(option);
			if (dir.name === config.rootDir) {
				option.setAttribute('selected', 'selected');
			}
		});
		configEl.showModal();
	}, (err) => {
		if (err.response.status === 401) {
			user.authorize();
		}
	});
}
