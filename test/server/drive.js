var tap = require('tap');
var rewire = require('rewire');
var sinon = require('sinon');
require('sinon-as-promised');
var driveApi = rewire('../../server/drive/api');

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
				create: sinon.spy()
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
			accessToken: '2233445566',
			rootDir: 'rootdir'
		});
		var auth = driveApi.__get__('auth');
		t.deepEqual(auth, {
			credentials: {
				access_token: '2233445566'
			}
		});
		t.ok(driveApi.__get__('drive').files.list.calledWith({
			auth: {
				credentials: {
					access_token: '2233445566'
				}
			},
			q: 'mimeType = \'application/vnd.google-apps.folder\' and \'rootdir\' in parents and trashed = false'
		}));
		t.end();
	});
	t.test('updateNote', (t) => {
		driveApi.updateNote({
			accessToken: '2233445566',
			fileId: 'test-file-id',
			content: 'new test content'
		});
		var auth = driveApi.__get__('auth');
		t.deepEqual(auth, {
			credentials: {
				access_token: '2233445566'
			}
		});
		t.ok(driveApi.__get__('drive').files.update.calledWith({
			auth: {
				credentials: {
					access_token: '2233445566'
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
		driveApi.updateNote({
			accessToken: '2233445566',
			fileId: 'test-file-id',
			content: 'new test content',
			name: 'new-note-name'
		});
		t.ok(driveApi.__get__('drive').files.update.calledWith({
			auth: {
				credentials: {
					access_token: '2233445566'
				}
			},
			fileId: 'test-file-id',
			media: {
				body: 'new test content',
				mimeType: 'text/x-markdown'
			},
			resource: {
				name: 'new-note-name'
			}
		}));
		t.end();
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
			accessToken: '2233445566',
			content: 'new note content'
		}).then((resp) => {
			t.ok(driveApi.__get__('findByName').calledOnce);
			t.ok(driveApi.__get__('findByName').calledWith({
				accessToken: '2233445566',
				name: 'Test',
				rootDir: 'notes-rootdir'

			}));
			t.ok(driveApi.__get__('createFolder').calledOnce);
			t.ok(driveApi.__get__('createFolder').calledWith({
				accessToken: '2233445566',
				name: 'Test',
				rootDir: 'notes-rootdir',
				content: 'new note content'
			}));
			t.ok(driveApi.__get__('createFile').calledOnce);
			t.ok(driveApi.__get__('createFile').calledWith({
				accessToken: '2233445566',
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
			accessToken: '2233445566',
			content: 'new note content'
		}).then((resp) => {
			var driveMock = driveApi.__get__('drive');
			t.ok(driveMock.files.create.calledTwice);
			t.ok(driveMock.files.create.firstCall.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566'
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
						access_token: '2233445566'
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
			accessToken: '2233445566',
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
			accessToken: '2233445566',
			fileId: 'test-note-file-id'
		}).then(() => {
			t.ok(getStub.calledOnce);
			t.ok(getStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566'
					}
				},
				fileId: 'test-note-file-id',
				fields: 'name,parents'
			}));
			t.ok(deleteStub.calledOnce);
			t.ok(deleteStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566'
					}
				},
				fileId: 'test-note-dir-id'
			}));
			driveRevert();
			t.end();
		});
	});
	t.end();
});
