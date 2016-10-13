var notification = document.querySelector('.notification');
var notificationTimeoutId;
var notificationMessage = notification.querySelector('.message');

module.exports = notify;
module.exports.clear = hideNotification;
module.exports.error = error;
module.exports.info = info;

notification.querySelector('.close')
	.addEventListener('click', hideNotification);

function showNotification () {
	notification.classList.add('active');
}

function hideNotification () {
	notification.classList.remove('active');
	notification.classList.remove('permanent');
	clearNotification();
}

function clearNotification () {
	notificationMessage.innerHTML = '';
	notification.setAttribute('data-type', '');
}

function notify (opts) {
	if (!opts || !Object.keys(opts).length) {
		return;
	}

	if (notification.classList.contains('active')) {
		clearNotification();
		clearTimeout(notificationTimeoutId);
	}

	if (opts.message) {
		notificationMessage.innerHTML = opts.message;
	}
	if (opts.type) {
		notification.setAttribute('data-type', opts.type);
	}
	showNotification();
	// auto dismiss after 10s
	var timeout = opts.timeout || 10000;
	if (!opts.permanent) {
		notificationTimeoutId = setTimeout(hideNotification, timeout);
	} else {
		notification.classList.add('permanent');
	}
}

function error (err) {
	if (!err.response) {
		notify({
			message: err.response.message || err,
			type: 'red'
		});
		return;
	}
	err.response.json()
		.then(function (resp) {
			notify({
				message: resp.message,
				type: 'red'
			});
		});
}

function info (message) {
	notify({
		message: message,
		type: 'blue'
	});
}
