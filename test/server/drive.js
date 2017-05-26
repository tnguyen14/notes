const tap = require('tap');
const rewire = require('rewire');
const sinon = require('sinon');
require('sinon-as-promised');
let driveApi = rewire('../../server/drive/api');

const credentials = {
	access_token: '2233445566',
	refresh_token: '12345'
};

function checkAuthBeingSet (t) {
	let auth = driveApi.__get__('auth');
	t.deepEqual(auth, {credentials});
}

tap.test('Drive API', (t) => {
	var authRevert, driveRevert;
	t.beforeEach((done) => {
		authRevert = driveApi.__set__('auth', {
			credentials: {
				access_token: '1122334455'
			}
		});
		driveRevert = driveApi.__set__('drive', {
			files: {
				list: sinon.spy(),
				update: sinon.spy(),
				create: sinon.spy(),
				get: sinon.spy()
			}
		});
		done();
	});
	t.afterEach((done) => {
		authRevert();
		driveRevert();
		done();
	});
	t.test('getDirs', (t) => {
		driveApi.getDirs({
			credentials,
			rootDir: 'rootdir'
		});
		checkAuthBeingSet(t);
		t.ok(driveApi.__get__('drive').files.list.calledWith({
			auth: {
				credentials
			},
			q: 'mimeType = \'application/vnd.google-apps.folder\' and \'rootdir\' in parents and trashed = false',
			fields: 'files(createdTime,id,kind,lastModifyingUser,md5Checksum,mimeType,modifiedByMeTime,modifiedTime,name)'
		}));
		t.end();
	});
	t.test('getDirs - error', (t) => {
		var listStub = sinon.stub();
		var listRevert = driveApi.__set__('drive', {
			files: {
				list: listStub
			}
		});
		// call the callback, which is at index 1, with error
		listStub.callsArgWith(1, new Error('Oops'));
		driveApi.getDirs({
			rootDir: 'badrootdir'
		}).then(() => {
			t.ok(false, 'this should not happen');
			listRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Oops');
			listRevert();
			t.end();
		});
	});
	t.test('getDirsAndFiles', (t) => {
		driveApi.getDirsAndFiles({
			credentials,
			rootDir: 'rootdir'
		});
		checkAuthBeingSet(t);
		t.deepEqual(driveApi.__get__('drive').files.list.getCall(0).args[0], {
			auth: {
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				}
			},
			q: '(mimeType = \'application/vnd.google-apps.folder\' or ' +
'mimeType = \'text/x-markdown\') and \'rootdir\' in parents and trashed = false',
			fields: 'files(createdTime,id,kind,lastModifyingUser,md5Checksum,' +
'mimeType,modifiedByMeTime,modifiedTime,name)'
		});
		t.end();
	});

	t.test('getFileContent - no fileId', (t) => {
		driveApi.getFileContent({})
			.then(() => {
				t.ok(false, 'this should not happen');
				t.end();
			}, (err) => {
				t.equal(err.message, 'No file ID was given.');
				t.end();
			});
	});

	t.test('getFileContent', (t) => {
		driveApi.getFileContent({
			credentials,
			fileId: 'fileId'
		});
		console.log({auth: {credentials}});
		checkAuthBeingSet(t);
		t.ok(driveApi.__get__('drive').files.get.calledWith({
			auth: {
				credentials
			},
			fileId: 'fileId',
			alt: 'media'
		}));
		t.end();
	});

	t.test('getFileContent - error', (t) => {
		let getRevert = driveApi.__set__('drive', {
			files: {
				get: sinon.stub().callsArgWith(1, new Error('Oops'))
			}
		});
		driveApi.getFileContent({
			fileId: 'fileId'
		}).then(() => {
			t.ok(false, 'this should not happen');
			getRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Oops');
			getRevert();
			t.end();
		});
	});

	t.test('getMarkdownFilesInFolders', (t) => {
		driveApi.getMarkdownFilesInFolders({
			credentials,
			folders: ['folder-1', 'folder-2', 'folder-3']
		});
		checkAuthBeingSet(t);
		t.deepEqual(driveApi.__get__('drive').files.list.getCall(0).args[0], {
			auth: {
				credentials
			},
			q: 'mimeType = \'text/x-markdown\' and (\'folder-1\' in parents ' +
'or \'folder-2\' in parents or \'folder-3\' in parents)',
			fields: 'files(createdTime,id,kind,lastModifyingUser,md5Checksum,' +
'mimeType,modifiedByMeTime,modifiedTime,name,parents)'
		});
		t.end();
	});

	t.test('getMarkdownFilesInFolders - error', (t) => {
		let listRevert = driveApi.__set__('drive', {
			files: {
				list: sinon.stub().callsArgWith(1, new Error('Oops'))
			}
		});
		driveApi.getMarkdownFilesInFolders({
			folders: ['folder-1', 'folder-2']
		}).then(() => {
			t.ok(false, 'this should not happen');
			listRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Oops');
			listRevert();
			t.end();
		});
	});

	t.test('updateNote', (t) => {
		driveApi.updateNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-file-id',
			content: 'new test content'
		});
		var auth = driveApi.__get__('auth');
		t.deepEqual(auth, {
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			}
		});
		t.ok(driveApi.__get__('drive').files.update.calledWith({
			auth: {
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				}
			},
			fileId: 'test-file-id',
			media: {
				body: 'new test content',
				mimeType: 'text/x-markdown'
			}
		}));
		t.end();
	});
	t.test('updateNote - with name', (t) => {
		var getStub = sinon.stub();
		var updateStub = sinon.stub();
		getStub.callsArgWith(1, null, {
			name: 'index.md',
			parents: ['test-note-dir-id']
		});
		updateStub.onFirstCall().callsArgWith(1, null, {
			kind: 'drive#file',
			id: 'test-file-id',
			name: 'index.md',
			mimeType: 'text/x-markdown'
		});
		updateStub.onSecondCall().callsArgWith(1, null, {
			kind: 'drive#file',
			id: 'test-note-dir-id',
			name: 'new-note-name',
			mimeType: 'application/vnd.google-apps.folder'
		});
		var driveRevert = driveApi.__set__('drive', {
			files: {
				get: getStub,
				update: updateStub
			}
		});
		driveApi.updateNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-file-id',
			content: 'new test content',
			name: 'new-note-name'
		}).then((resp) => {
			t.ok(getStub.calledOnce);
			t.ok(getStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-file-id',
				fields: 'name,parents'
			}));
			t.ok(updateStub.calledTwice);
			t.ok(updateStub.firstCall.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-file-id',
				media: {
					body: 'new test content',
					mimeType: 'text/x-markdown'
				}
			}));
			t.ok(updateStub.secondCall.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-note-dir-id',
				resource: {
					name: 'new-note-name'
				}
			}));
			t.deepEqual(resp, {
				id: 'test-file-id',
				mimeType: 'text/x-markdown',
				kind: 'drive#file',
				name: 'new-note-name'
			});
			driveRevert();
			t.end();
		});
	});
	t.test('updateNote - error', (t) => {
		var driveRevert = driveApi.__set__('drive', {
			files: {
				update: sinon.stub().callsArgWith(1, new Error('Oops'))
			}
		});
		driveApi.updateNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-file-id',
			content: 'new test content',
			name: 'new-note-name'
		}).then(() => {
			t.ok(false, 'This should not occur');
			driveRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Oops');
			driveRevert();
			t.end();
		});
	});
	t.test('createNote - stubbing createFolder and createFile', (t) => {
		var findByNameRevert = driveApi.__set__('findByName', sinon.stub().resolves([]));
		var createFolderRevert = driveApi.__set__('createFolder', sinon.stub().resolves({
			kind: 'drive#file',
			id: 'test-folder',
			name: 'Test',
			mimeType: 'application/vnd.google-apps.folder'
		}));
		var createFileRevert = driveApi.__set__('createFile', sinon.stub().resolves({
			kind: 'drive#file',
			id: 'test-markdown-file',
			name: 'index.md',
			mimeType: 'text/x-markdown'
		}));
		driveApi.createNote({
			name: 'Test',
			rootDir: 'notes-rootdir',
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			content: 'new note content'
		}).then((resp) => {
			t.ok(driveApi.__get__('findByName').calledOnce);
			t.ok(driveApi.__get__('findByName').calledWith({
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				},
				name: 'Test',
				rootDir: 'notes-rootdir'

			}));
			t.ok(driveApi.__get__('createFolder').calledOnce);
			t.ok(driveApi.__get__('createFolder').calledWith({
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				},
				name: 'Test',
				rootDir: 'notes-rootdir',
				content: 'new note content'
			}));
			t.ok(driveApi.__get__('createFile').calledOnce);
			t.ok(driveApi.__get__('createFile').calledWith({
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				},
				name: 'index.md',
				rootDir: 'notes-rootdir',
				content: 'new note content',
				parent: 'test-folder'
			}));
			t.deepEqual(resp, {
				kind: 'drive#file',
				id: 'test-markdown-file',
				name: 'index.md',
				mimeType: 'text/x-markdown'
			});
			findByNameRevert();
			createFolderRevert();
			createFileRevert();
			t.end();
		});
	});
	t.test('createNote - no stubs', (t) => {
		var findByNameRevert = driveApi.__set__('findByName', sinon.stub().resolves([]));
		var createStub = sinon.stub();
		createStub.onFirstCall().callsArgWith(1, null, {
			kind: 'drive#file',
			id: 'test-folder',
			name: 'Test',
			mimeType: 'application/vnd.google-apps.folder'
		});
		createStub.onSecondCall().callsArgWith(1, null, {
			kind: 'drive#file',
			id: '0B3UJMNijnL12OVJZWXZLbGctVms',
			name: 'index.md',
			mimeType: 'text/x-markdown'
		});
		var createRevert = driveApi.__set__('drive', {
			files: {
				list: sinon.spy(),
				create: createStub
			}
		});
		driveApi.createNote({
			name: 'Test',
			rootDir: 'notes-rootdir',
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			content: 'new note content'
		}).then((resp) => {
			var driveMock = driveApi.__get__('drive');
			t.ok(driveMock.files.create.calledTwice);
			t.ok(driveMock.files.create.firstCall.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				resource: {
					name: 'Test',
					mimeType: 'application/vnd.google-apps.folder',
					parents: ['notes-rootdir']
				}
			}));
			t.ok(driveMock.files.create.secondCall.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				resource: {
					name: 'index.md',
					parents: ['test-folder']
				},
				media: {
					body: 'new note content',
					mimeType: 'text/x-markdown'
				}
			}));
			findByNameRevert();
			createRevert();
			t.end();
		});
	});
	t.test('createNote - use file', (t) => {
		var findByNameRevert = driveApi.__set__('findByName', sinon.stub().resolves([]));
		var createStub = sinon.stub();
		createStub.callsArgWith(1, null, {
			kind: 'drive#file',
			id: '0B3UJMNijnL12OVJZWXZLbGctVms',
			name: 'Test',
			mimeType: 'text/x-markdown'
		});
		var createRevert = driveApi.__set__('drive', {
			files: {
				list: sinon.spy(),
				create: createStub
			}
		});
		driveApi.createNote({
			name: 'Test',
			rootDir: 'notes-rootdir',
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			content: 'new note content',
			useFile: true
		}).then((resp) => {
			var driveMock = driveApi.__get__('drive');
			t.ok(driveMock.files.create.calledOnce);
			t.ok(driveMock.files.create.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				resource: {
					name: 'Test.md',
					parents: ['notes-rootdir']
				},
				media: {
					body: 'new note content',
					mimeType: 'text/x-markdown'
				}
			}));
			findByNameRevert();
			createRevert();
			t.end();
		});
	});

	t.test('createNote - already exists', (t) => {
		var findByNameRevert = driveApi.__set__('findByName', sinon.stub().resolves([{
			kind: 'drive#file',
			id: 'note-already-exists',
			name: 'Current Note',
			mimeType: 'application/vnd.google-apps.folder'
		}]));
		driveApi.createNote({
			name: 'Current Note',
			rootDir: 'notes-rootdir',
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			content: 'new note content'
		}).then(() => {
			t.ok(false, 'Should not succeed');
			findByNameRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Note "Current Note" already exists.');
			findByNameRevert();
			t.end();
		});
	});
	t.test('deleteNote', (t) => {
		var getStub = sinon.stub();
		var deleteStub = sinon.stub();
		var driveRevert = driveApi.__set__('drive', {
			files: {
				get: getStub,
				delete: deleteStub
			}
		});
		getStub.callsArgWith(1, null, {
			name: 'index.md',
			parents: ['test-note-dir-id']
		});
		deleteStub.callsArgWith(1, null, undefined);
		driveApi.deleteNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-note-file-id'
		}).then(() => {
			t.ok(getStub.calledOnce);
			t.ok(getStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-note-file-id',
				fields: 'name,parents'
			}));
			t.ok(deleteStub.calledOnce);
			t.ok(deleteStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-note-dir-id'
			}));
			driveRevert();
			t.end();
		});
	});
	t.test('deleteNote - error', (t) => {
		var driveGetRevert = driveApi.__set__('drive', {
			files: {
				get: sinon.stub().callsArgWith(1, new Error('Oops'))
			}
		});
		driveApi.deleteNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-note-file-id'
		}).then(() => {
			t.ok(false);
			driveGetRevert();
			t.end();
		}, (err) => {
			t.equal(err.message, 'Oops');
			driveGetRevert();
			var driveDeleteRevert = driveApi.__set__('drive', {
				files: {
					get: sinon.stub().callsArgWith(1, null, {
						name: 'index.md',
						parents: ['test-note-dir-id']
					}),
					delete: sinon.stub().callsArgWith(1, new Error('Oops'))
				}
			});
			driveApi.deleteNote({
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				},
				fileId: 'test-note-file-id'
			}).then(() => {
				t.ok(false);
				driveDeleteRevert();
				t.end();
			}, (err) => {
				t.equal(err.message, 'Oops');
				driveDeleteRevert();
				t.end();
			});
		});
	});
	t.end();
});
