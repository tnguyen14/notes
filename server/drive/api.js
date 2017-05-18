var google = require('googleapis');
var drive = google.drive('v3');
var OAuth2 = google.auth.OAuth2;
var auth = new OAuth2();
var debug = require('debug')('notes');

var mimeTypes = {
	md: 'text/x-markdown',
	folder: 'application/vnd.google-apps.folder'
};

var noteFields = [
	'createdTime',
	'id',
	'kind',
	'lastModifyingUser',
	'mimeType',
	'modifiedByMeTime',
	'modifiedTime',
	'name'
];

module.exports = {
	getDirs,
	getDirsAndFiles,
	// getFolderChildren is not used for now, but might be useful later
	getFolderChildren,
	getMarkdownFilesOfFolders,
	getFileContent,
	updateNote,
	createNote,
	deleteNote,
	mimeTypes,
	pickFileProperties
};

function getDirs (opts) {
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: `mimeType = '${mimeTypes.folder}' and '${opts.rootDir}' in parents and trashed = false`,
			fields: 'files(' + noteFields.join(',') + ')'
		}, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

function getDirsAndFiles (opts) {
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: `(mimeType = '${mimeTypes.folder}' or mimeType = '${mimeTypes.md}') and '${opts.rootDir}' in parents and trashed = false`,
			fields: 'files(' + noteFields.join(',') + ')'
		}, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

function getFileContent (opts) {
	if (!opts.fileId) {
		return Promise.reject(new Error('No file ID was given.'));
	}
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.get({
			auth: auth,
			fileId: opts.fileId,
			alt: 'media'
		}, (err, resp) => {
			if (err) {
				debug(err);
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
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: '\'' + opts.folderId + '\'' + ' in parents',
			fields: 'files(' + noteFields.join(',') + ')'
		}, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

// get all the markdown files that are in all of the folders
function getMarkdownFilesOfFolders (opts) {
	if (!opts.folders) {
		return;
	}
	auth.credentials = opts.credentials;
	let foldersQuery = opts.folders.map((folder) => {
		return `'${folder}' in parents`;
	}).join(' or ');
	debug(foldersQuery);
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: `mimeType = '${mimeTypes.md}' and (${foldersQuery})`,
			// add the parents field
			fields: `files(${noteFields.join(',')},parents)`
		}, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
				return;
			}
			resolve(resp.files);
		});
	});
}

function pickFileProperties ({name, id, createdTime, modifiedTime, modifiedByMeTime, lastModifyingUser: {me}}) {
	return {name, id, createdTime, modifiedTime, modifiedByMeTime, lastModifyingUser: {me}};
}

function updateNote (opts) {
	auth.credentials = opts.credentials;
	let params = {
		auth: auth,
		fileId: opts.fileId,
		media: {
			body: opts.content,
			mimeType: mimeTypes.md
		}
	};
	let toChangeName;
	if (opts.name) {
		toChangeName = opts.fileId;
	}
	return new Promise((resolve, reject) => {
		drive.files.update(params, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
				return;
			}
			// if no name change, done
			if (!toChangeName) {
				return resolve(resp);
			}
			// look up file to see if it has a parent folder
			drive.files.get({
				auth: auth,
				fileId: toChangeName,
				fields: 'name,parents'
			}, (err, resp2) => {
				if (err) {
					debug(err);
					return reject(err);
				}
				if (resp.name === 'index.md') {
					toChangeName = resp2.parents[0];
				}
				drive.files.update({
					auth: auth,
					fileId: toChangeName,
					resource: {
						name: opts.name
					}
				}, (err, resp3) => {
					if (err) {
						debug(err);
						return reject(err);
					}
					// return back the original note file, with the new name
					resolve(Object.assign({}, resp, {
						name: resp3.name
					}));
				});
			});
		});
	});
}

function findByName (opts) {
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.list({
			auth: auth,
			q: 'name contains \'' + opts.name + '\' and trashed = false',
			fields: 'files(id,mimeType,name,parents)'
		}, (err, resp) => {
			if (err) {
				debug(err);
				reject(err);
			}
			if (!resp) {
				return false;
			}
			resolve(resp.files.filter((file) => {
				if (file.parents.indexOf(opts.rootDir) === -1) {
					return false;
				}
				if (file.mimeType === mimeTypes.folder || file.mimeType === mimeTypes.md) {
					return true;
				}
			}));
		});
	});
}

function createFolder (opts) {
	auth.credentials = opts.credentials;
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
				debug(err);
				reject(err);
				return;
			}
			resolve(resp);
		});
	});
}

function createFile (opts) {
	auth.credentials = opts.credentials;
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
				debug(err);
				return reject(err);
			}
			resolve(resp);
		});
	});
}
function createNote (opts) {
	return findByName({
		credentials: opts.credentials,
		name: opts.name,
		rootDir: opts.rootDir
	}).then((files) => {
		if (files.length > 0) {
			return Promise.reject(new Error('Note "' + opts.name + '" already exists.'));
		}
		// allow for create new note as just a file (without folder)
		if (opts.useFile) {
			return createFile(Object.assign({}, opts, {
				name: opts.name + '.md',
				parent: opts.rootDir
			}));
		} else {
			return createFolder(opts)
				.then((resp) => {
					return createFile(Object.assign({}, opts, {
						name: 'index.md',
						parent: resp.id
					}));
				});
		}
	});
}

function deleteNote (opts) {
	var toDelete = opts.fileId;
	auth.credentials = opts.credentials;
	return new Promise((resolve, reject) => {
		drive.files.get({
			auth: auth,
			fileId: opts.fileId,
			fields: 'name,parents'
		}, (err, resp) => {
			if (err) {
				debug(err);
				return reject(err);
			}
			if (resp.name === 'index.md') {
				toDelete = resp.parents[0];
			}
			drive.files.delete({
				auth: auth,
				fileId: toDelete
			}, (err, resp) => {
				if (err) {
					debug(err);
					return reject(err);
				}
				resolve({
					status: 'OK!'
				});
			});
		});
	});
}
