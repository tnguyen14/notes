var loaders = {
	circle: document.getElementById('loader-circle')
};

module.exports.show = showLoader;
module.exports.hide = removeLoader;

/**
 * @param el {Node} the element to insert the loader after
 */
function showLoader (el, type) {
	var template = loaders[type || 'circle'];
	var loader = document.importNode(template.content, true);
	var elToAttach = el || document.body;
	elToAttach.appendChild(loader);
	return loader;
}

function removeLoader (el) {
	var loader = el.querySelector('.loader');
	if (!loader) {
		return;
	}
	loader.parentNode.removeChild(loader);
}
