var path = require('path');
var google = require('googleapis');
var drive = google.drive('v3');
var OAuth2 = google.auth.OAuth2;
var auth = new OAuth2();

var mimeTypes = {
	md: 'text/x-markdown',
	folder: 'application/vnd.google-apps.folder'
};

module.exports = {
	getDirs: getDirs,
	processFile: processFile,
	updateNote: updateNote,
	createNote: createNote,
	deleteNote: deleteNote
};

function getDirs (opts) {
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: `mimeType = '${mimeTypes.folder}' and '${opts.rootDir}' in parents and trashed = false`
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

function getFileContent (opts) {
	if (!opts.fileId) {
		return;
	}
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.get({
			auth: auth,
			fileId: opts.fileId,
			alt: 'media'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp);
		});
	});
}

function getFolderChildren (opts) {
	if (!opts.folderId) {
		return;
	}
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			corpus: 'user',
			q: '\'' + opts.folderId + '\'' + ' in parents'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

/**
 * @param {Object} file
 * @param {String} file.id eg. '0B8Jsod-g6nz2ZWRzRjNqdzZVRE0a'
 * @param {String} file.name
 * @param {String} file.mimeType 'application/vnd.google-apps.folder' or
 * 'text/x-markdown'
 */
function processFile (opts) {
	var file = opts.file;
	switch (file.mimeType) {
		case mimeTypes.md:
			let ext = path.extname(file.name);
			return getFileContent({
				fileId: file.id,
				accessToken: opts.accessToken
			}).then((content) => {
				return {
					id: file.id,
					name: path.basename(file.name, ext),
					content: content
				};
			});
		case mimeTypes.folder:
			let indexMd;
			return getFolderChildren({
				folderId: file.id,
				accessToken: opts.accessToken
			}).then((files) => {
				indexMd = files.find((f) => {
					return f.name === 'index.md';
				});
				if (!indexMd) {
					return;
				}
				return indexMd.id;
			}).then((fileId) => {
				return getFileContent({
					fileId: fileId,
					accessToken: opts.accessToken
				});
			}).then((content) => {
				if (content) {
					return {
						name: file.name,
						id: indexMd.id,
						content: content
					};
				}
			});
	}
}

function findByName (name, rootDir) {
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: 'name contains \'' + name + '\' and trashed = false',
			fields: 'files(id,mimeType,name,parents)'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
			}
			resolve(resp.files.filter((file) => {
				if (file.parents.indexOf(rootDir) === -1) {
					return false;
				}
				if (file.mimeType === mimeTypes.folder || file.mimeType === mimeTypes.md) {
					return true;
				}
			}));
		});
	});
}

function updateNote (opts) {
	auth.credentials.access_token = opts.accessToken;
	let params = {
		auth: auth,
		fileId: opts.fileId,
		media: {
			body: opts.content,
			mimeType: mimeTypes.md
		}
	};
	if (opts.name) {
		params.resource = {
			name: opts.name
		};
	}
	return new Promise((resolve, reject) => {
		drive.files.update(params, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp);
		});
	});
}

function createFolder (opts) {
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.create({
			auth: auth,
			resource: {
				name: opts.name,
				mimeType: mimeTypes.folder,
				parents: [opts.rootDir]
			}
		}, (err, resp) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			resolve(resp);
		});
	});
}

function createFile (opts) {
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.create({
			auth: auth,
			resource: {
				name: opts.name,
				parents: [opts.parent]
			},
			media: {
				body: opts.content,
				mimeType: mimeTypes.md
			}
		}, (err, resp) => {
			if (err) {
				console.error(err);
				return reject(err);
			}
			resolve(resp);
		});
	});
}
function createNote (opts) {
	return findByName(opts.name, opts.rootDir).then((files) => {
		if (files.length > 0) {
			return Promise.reject(new Error('Note "' + opts.name + '" already exists.'));
		}
		return createFolder(opts);
	}).then((resp) => {
		return createFile(Object.assign({}, opts, {
			name: 'index.md',
			parent: resp.id
		}));
	});
}

function deleteNote (opts) {
	var toDelete = opts.fileId;
	auth.credentials.access_token = opts.accessToken;
	return new Promise((resolve, reject) => {
		drive.files.get({
			auth: auth,
			fileId: opts.fileId,
			fields: 'name,parents'
		}, (err, resp) => {
			if (err) {
				console.error(err);
				return reject(err);
			}
			if (resp.name === 'index.md') {
				toDelete = resp.parents[0];
			}
			drive.files.delete({
				fileId: toDelete
			}, (err, resp) => {
				if (err) {
					console.error(err);
					return reject(err);
				}
				resolve(resp);
			});
		});
	});
}
