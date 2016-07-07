var notification = document.querySelector('.notification');
var notificationTimeoutId;
var notificationMessage = notification.querySelector('.message');
notification.querySelector('.close').addEventListener('click', hideNotification);
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
module.exports = function notify (opts) {
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
};
