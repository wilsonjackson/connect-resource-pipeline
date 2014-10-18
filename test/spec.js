/* global describe, it */
var chai = require('chai');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var sinon = require('sinon');
var resourcePipeline = require('..');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var through = require('through2');

describe('Connect resource pipeline middleware', function () {
	this.timeout(1000);

	function testMiddleware(url, middleware) {
		var result = {
			request: {url: url},
			endWasCalled: false,
			nextWasCalled: false,
			headers: {},
			content: null
		};
		var d = Q.defer();

		var response = {
			setHeader: function (name, value) {
				result.headers[name] = value;
			},

			end: function (buffer) {
				result.endWasCalled = true;
				result.content = buffer.toString('utf-8');
				d.fulfill(result);
			}
		};

		function next() {
			result.nextWasCalled = true;
			d.fulfill(result);
		}

		middleware(result.request, response, next);

		return {
			verify: function (cb, done) {
				d.promise
					.then(cb)
					.then(function () {
						done();
					}, function (error) {
						done(error);
					});
			}
		};
	}

	function readFile(file) {
		return fs.readFileSync(file).toString('utf-8');
	}

	it('should forward to next middleware when no files are found', function (done) {
		var url = '/test/fixtures/non-existent-file.html';
		testMiddleware(url, resourcePipeline([{url: url}]))
			.verify(function (result) {
				expect(result.endWasCalled).to.equal(false, 'Response should not have been called');
				expect(result.nextWasCalled).to.equal(true, 'Next should have been called');
			}, done);
	});

	it('should forward to next middleware when there is no URL match', function (done) {
		testMiddleware('/the-current-url', resourcePipeline([{url: '/not-the-current-url'}]))
			.verify(function (result) {
				expect(result.endWasCalled).to.equal(false, 'Response should not have been called');
				expect(result.nextWasCalled).to.equal(true, 'Next should have been called');
			}, done);
	});

	it('should match and serve a static url', function (done) {
		var url = '/test/fixtures/file.html';
		testMiddleware(url, resourcePipeline([{url: url}]))
			.verify(function (result) {
				expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
				expect(result.content).to.equal(readFile('test/fixtures/file.html'));
			}, done);
	});

	it('should match a directory path and serve an index file', function (done) {
		var url = '/test/fixtures/';
		testMiddleware(url, resourcePipeline([{url: url}]))
			.verify(function (result) {
				expect(result.content).to.equal(readFile('test/fixtures/index.html'));
			}, done);
	});

	it('should match and serve an explicitly referenced index file', function (done) {
		var url = '/test/fixtures/';
		testMiddleware(url, resourcePipeline([{url: url + 'index.html'}]))
			.verify(function (result) {
				expect(result.content).to.equal(readFile('test/fixtures/index.html'));
			}, done);
	});

	it('should allow configuration of a custom index file', function (done) {
		var indexFile = 'file.html';
		var url = '/test/fixtures/';
		testMiddleware(url, resourcePipeline({indexFile: indexFile}, [{url: url}]))
			.verify(function (result) {
				expect(result.content).to.equal(readFile('test/fixtures/file.html'));
			}, done);
	});

	it('should match and serve a regex url', function (done) {
		var url = '/test/fixtures/file2.html';
		var re = /^\/test\/.*\/\w+2\.html/;
		testMiddleware(url, resourcePipeline([{url: re}]))
			.verify(function (result) {
				expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
				expect(result.content).to.equal(readFile('test/fixtures/file2.html'));
			}, done);
	});

	it('should set a mime type based on the requested file\'s extension', function (done) {
		var url = '/test/fixtures/file.html';
		testMiddleware(url, resourcePipeline([{url: url}]))
			.verify(function (result) {
				expect(result.headers['Content-Type']).to.match(/^text\/html/);
			}, done);
	});

	it('should allow an explicitly set mime type', function (done) {
		var url = '/test/fixtures/file.html';
		var mimeType = 'x-type/x-template';
		testMiddleware(url, resourcePipeline([{url: url, mimeType: mimeType}]))
			.verify(function (result) {
				expect(result.headers['Content-Type']).to.equal(mimeType);
			}, done);
	});

	it('should serve explicitly specified files', function (done) {
		var url = '/';
		testMiddleware(url, resourcePipeline([{url: url, files: ['test/fixtures/file2.html']}]))
			.verify(function (result) {
				expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
				expect(result.content).to.equal(readFile('test/fixtures/file2.html'));
			}, done);
	});

	it('should serve multiple concatenated files', function (done) {
		var url = '/';
		var middleware = resourcePipeline([
			{url: url, files: ['test/fixtures/file.html', 'test/fixtures/file2.html']}
		]);
		testMiddleware(url, middleware)
			.verify(function (result) {
				expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
				expect(result.content).to.equal(
						readFile('test/fixtures/file.html') + readFile('test/fixtures/file2.html'));
			}, done);
	});

	describe('when processing content', function () {
		function replaceContent(newContent) {
			return through.obj(function (file, enc, cb) {
				file.contents = new Buffer(newContent, 'utf-8');
				this.push(file);
				cb();
			});
		}

		describe('using a pipeline', function () {
			it('should pipe content through the user-provided pipeline', function (done) {
				var url = '/test/fixtures/file.html';
				var newContent = 'This information has been changed.';
				var middleware = resourcePipeline([{url: url, pipeline: function (files) {
					return files.pipe(replaceContent(newContent));
				}}]);
				testMiddleware(url, middleware)
					.verify(function (result) {
						expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
						expect(result.content).to.equal(newContent);
					}, done);
			});

			it('should call user-provided pipeline with the request object', function (done) {
				var pipeline = sinon.stub();
				pipeline.returnsArg(0);
				var url = '/test/fixtures/file.html';
				var middleware = resourcePipeline([{url: url, pipeline: pipeline}]);
				testMiddleware(url, middleware)
					.verify(function (result) {
						expect(pipeline).to.have.been.calledWith(sinon.match.any, result.request);
					}, done);
			});
		});

		describe('using factories', function () {
			it('should pipe content through user-defined processors', function (done) {
				var url = '/test/fixtures/file.html';
				var newContent = 'This information has been changed.';
				var middleware = resourcePipeline([{url: url, factories: [replaceContent.bind(null, newContent)]}]);
				testMiddleware(url, middleware)
					.verify(function (result) {
						expect(result.nextWasCalled).to.equal(false, 'Next should not have been called');
						expect(result.content).to.equal(newContent);
					}, done);
			});
		});
	});

	describe('options', function () {
		it('should apply a root directory to implicitly matched files', function (done) {
			var root = './test';
			var url = '/fixtures/file.html';
			var middleware = resourcePipeline({root: root}, [{url: url}]);
			testMiddleware(url, middleware)
				.verify(function (result) {
					expect(result.content).to.equal(readFile('test/fixtures/file.html'));
				}, done);
		});

		it('should apply a root directory to explicitly matched files', function (done) {
			var url = '/';
			var middleware = resourcePipeline({root: './test'}, [
				{url: url, files: ['fixtures/file.html', 'fixtures/file2.html']}
			]);
			testMiddleware(url, middleware)
				.verify(function (result) {
					expect(result.content).to.equal(
							readFile('test/fixtures/file.html') + readFile('test/fixtures/file2.html'));
				}, done);
		});

		it('should not prefix a root directory on absolute file paths', function (done) {
			var url = '/';
			var absPath = path.resolve('test/fixtures/file.html');
			var middleware = resourcePipeline({root: './test'}, [{url: url, files: absPath}]);
			testMiddleware(url, middleware)
				.verify(function (result) {
					expect(result.content).to.equal(readFile('test/fixtures/file.html'));
				}, done);
		});
	});
});
