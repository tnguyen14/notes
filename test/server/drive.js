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
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			rootDir: 'rootdir'
		});
		var auth = driveApi.__get__('auth');
		t.deepEqual(auth, {
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			}
		});
		t.ok(driveApi.__get__('drive').files.list.calledWith({
			auth: {
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				}
			},
			q: 'mimeType = \'application/vnd.google-apps.folder\' and \'rootdir\' in parents and trashed = false',
			fields: 'files(createdTime,id,kind,lastModifyingUser,mimeType,modifiedByMeTime,modifiedTime,name)'
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
	t.test('processFile - folder - stub getFolderChildren and getFileContent', (t) => {
		var getFolderChildrenStub = sinon.stub().resolves([{
			id: 'test-note-index-id',
			name: 'index.md',
			kind: 'drive#file',
			mimeType: 'text/x-markdown',
			createdTime: '2016-09-15T02:01:27.674Z',
			modifiedTime: '2016-10-13T01:48:18.170Z',
			modifiedByMeTime: '2016-10-13T01:48:18.170Z',
			lastModifyingUser: {
				kind: 'drive#user',
				displayName: 'Test D. User',
				photoLink: 'https://lh3.googleusercontent.com/asd/fd/photo.jpg',
				me: true,
				permissionId: '04428089804842140789',
				emailAddress: 'testuser@email.com'
			}
		}]);
		var getFolderChildrenRevert = driveApi.__set__('getFolderChildren', getFolderChildrenStub);
		var getFileContentStub = sinon.stub().resolves('## Note content');
		var getFileContentRevert = driveApi.__set__('getFileContent', getFileContentStub);
		driveApi.processFile({
			file: {
				mimeType: 'application/vnd.google-apps.folder',
				id: 'test-note-dir-id',
				name: 'Test',
				kind: 'drive#file'
			},
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			}
		}).then((resp) => {
			t.ok(getFolderChildrenStub.calledOnce);
			t.ok(getFolderChildrenStub.calledWith({
				folderId: 'test-note-dir-id',
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				}
			}));
			t.ok(getFileContentStub.calledOnce);
			t.ok(getFileContentStub.calledWith({
				fileId: 'test-note-index-id',
				credentials: {
					access_token: '2233445566',
					refresh_token: '12345'
				}
			}));
			t.deepEqual(resp, {
				name: 'Test',
				id: 'test-note-index-id',
				content: '## Note content',
				createdTime: '2016-09-15T02:01:27.674Z',
				modifiedTime: '2016-10-13T01:48:18.170Z',
				modifiedByMeTime: '2016-10-13T01:48:18.170Z',
				lastModifyingUser: {
					me: true
				}
			});
			getFolderChildrenRevert();
			getFileContentRevert();
			t.end();
		});
	});
	t.test('processFile - folder - stub drive apis', (t) => {
		var listStub = sinon.stub();
		var getStub = sinon.stub();
		listStub.callsArgWith(1, null, {
			files: [{
				id: 'test-note-index-id',
				name: 'index.md',
				kind: 'drive#file',
				mimeType: 'text/x-markdown',
				createdTime: '2016-07-17T23:58:41.712Z',
				modifiedTime: '2016-10-11T18:25:20.634Z',
				modifiedByMeTime: '2016-10-11T18:25:20.634Z',
				lastModifyingUser: {
					kind: 'drive#user',
					displayName: 'Test D. User',
					me: true,
					photoLink: 'https://lh3.googleusercontent.com/asd/fd/photo.jpg',
					permissionId: '04428089804842140789',
					emailAddress: 'testuser@email.com'
				}
			}]
		});
		getStub.callsArgWith(1, null, '## Note content');
		var driveRevert = driveApi.__set__('drive', {
			files: {
				get: getStub,
				list: listStub
			}
		});
		driveApi.processFile({
			file: {
				mimeType: 'application/vnd.google-apps.folder',
				id: 'test-note-dir-id',
				name: 'Test',
				kind: 'drive#file'
			},
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			}
		}).then((resp) => {
			t.ok(listStub.calledOnce);
			t.ok(listStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				q: '\'test-note-dir-id\' in parents',
				fields: 'files(createdTime,id,kind,lastModifyingUser,mimeType,modifiedByMeTime,modifiedTime,name)'
			}));
			t.ok(getStub.calledOnce);
			t.ok(getStub.calledWith({
				auth: {
					credentials: {
						access_token: '2233445566',
						refresh_token: '12345'
					}
				},
				fileId: 'test-note-index-id',
				alt: 'media'
			}));
			t.deepEqual(resp, {
				name: 'Test',
				id: 'test-note-index-id',
				content: '## Note content',
				createdTime: '2016-07-17T23:58:41.712Z',
				modifiedTime: '2016-10-11T18:25:20.634Z',
				modifiedByMeTime: '2016-10-11T18:25:20.634Z',
				lastModifyingUser: {
					me: true
				}
			});
			driveRevert();
			t.end();
		}, (err) => {
			console.error(err);
			t.ok(false);
			driveRevert();
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
		driveApi.updateNote({
			credentials: {
				access_token: '2233445566',
				refresh_token: '12345'
			},
			fileId: 'test-file-id',
			content: 'new test content',
			name: 'new-note-name'
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
			},
			resource: {
				name: 'new-note-name'
			}
		}));
		t.end();
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
