var loaders = {
	circle: document.getElementById('loader-circle')
};

module.exports.show = showLoader;
module.exports.hide = removeLoader;

/**
 * @param el {Node} the element to insert the loader after
 * @param type {String} type of loader, default to 'circle'
 */
function showLoader (el, type) {
	var template = loaders[type || 'circle'];
	var elToAttach = el || document.body;
	var loader = elToAttach.querySelector('.loader');
	if (!loader) {
		loader = document.importNode(template.content, true);
		elToAttach.appendChild(loader);
		// select it again so loader can be an element, not document fragment
		// that is needed to access classList, because classList is undefined
		// for document fragment
		loader = elToAttach.querySelector('.loader');
	}
	loader.classList.add('active');
	el.classList.add('loading');
	return loader;
}

function removeLoader (el) {
	var loader = el.querySelector('.loader');
	if (!loader) {
		return;
	}
	loader.classList.remove('active');
	el.classList.remove('loading');
	return loader;
}
