var tap = require('tap');
var request = require('request');
var local = require('../../server/local');
var path = require('path');
var fs = require('fs');

var express = require('express');
var app = express();
var port = 3002;
var baseUrl = 'http://localhost:' + port;

app.use('/', local({
	rootDir: path.resolve(__dirname, './fixtures'),
	label: 'Test'
}));

var server = app.listen(port);

tap.test('get all notes', function (t) {
	request(baseUrl, function (err, resp, body) {
		t.notOk(err);
		t.strictSame(JSON.parse(body), {
			notes: [{
				path: 'Example Note/index.md',
				name: 'Example Note',
				content: ''
			}, {
				path: 'Standalone Note.md',
				name: 'Standalone Note',
				content: ''
			}],
			label: 'Test'
		});
		t.end();
	});
});

tap.test('add new note', function (t) {
	request.post(baseUrl, {
		json: true,
		body: {
			name: 'A New Note',
			content: '# Hello World'
		}
	}, function (err, resp, body) {
		t.notOk(err);
		fs.readdir(path.resolve(__dirname, './fixtures'), function (err, res) {
			t.notOk(err);
			t.strictSame(res, [
				'A New Note',
				'Example Note',
				'Standalone Note.md'
			]);
			fs.readFile(path.resolve(__dirname, './fixtures/A New Note/index.md'), 'utf8', function (err, content) {
				t.notOk(err);
				t.same(content, '# Hello World');
				t.end();
			});
		});
	});
});

tap.test('update note', function (t) {
	request.put(baseUrl + '/' + encodeURIComponent('A New Note/index.md'), {
		json: true,
		body: {
			content: '# Foo Bar'
		}
	}, function (err, resp, body) {
		t.notOk(err);
		fs.readFile(path.resolve(__dirname, './fixtures/A New Note/index.md'), 'utf8', function (err, content) {
			t.notOk(err);
			t.same(content, '# Foo Bar');
			t.end();
		});
	});
});

tap.test('update note title', function (t) {
	request.put(baseUrl + '/' + encodeURIComponent('A New Note/index.md'), {
		json: true,
		body: {
			name: 'Test Note',
			content: '# Testing'
		}
	}, function (err, resp, body) {
		t.notOk(err);
		fs.readFile(path.resolve(__dirname, './fixtures/Test Note/index.md'), 'utf8', function (err, content) {
			t.notOk(err);
			t.same(content, '# Testing');
			t.end();
		});
	});
});

tap.test('remove note', function (t) {
	request.delete(baseUrl + '/' + encodeURIComponent('Test Note/index.md'), function (err, resp, body) {
		t.notOk(err);
		fs.readdir(path.resolve(__dirname, './fixtures'), function (err, res) {
			t.notOk(err);
			t.strictSame(res, [
				'Example Note',
				'Standalone Note.md'
			]);
			t.end();
		});
	});
});

tap.test('tear down', function (t) {
	server.close();
	t.end();
});
