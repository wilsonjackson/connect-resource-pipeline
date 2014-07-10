var util = require('util');
var path = require('path');
var url = require('url');
var mime = require('mime');
var vinyl = require('vinyl-fs');
var through = require('through2');
var terminus = require('terminus');

function sendThroughPipes(files, factories, res, next, urlPath) {
	var numFiles = 0;
	var stream = vinyl.src(files);
	factories.forEach(function (factory) {
		// Send matched files through user-defined pipes
		stream = stream.pipe(factory());
	});
	stream
		.pipe(through.obj(function (file, enc, callback) {
			// Count files to detect an empty stream
			++numFiles;
			// Replace Vinyl File with Buffer
			this.push(file.contents);
			callback();
		}))
		.pipe(terminus.concat(function (content) {
			if (numFiles > 0) {
				var type = mime.lookup(urlPath);
				var charset = mime.charsets.lookup(type);
				res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
				res.end(content);
			}
			else {
				// If no files were matched, forward to next middleware (but issue a warning)
				console.warn('connect-resource-pipeline matched URL "' + urlPath + '" but found no files matching [' +
					files + ']');
				next();
			}
		}));
}

function isAbsolute(filePath) {
	return path.resolve(filePath) === path.normalize(filePath);
}

function resolveFilePaths(root, files) {
	return [].concat(files).map(function (filePath) {
		return isAbsolute(filePath) ? filePath : path.normalize(path.join(root, filePath));
	});
}

function resourcePipeline(options, targets) {
	if (util.isArray(options)) {
		targets = options;
		options = {};
	}
	var root = options.root || path.join('.', '');
	return function (req, res, next) {
		for (var i = 0; i < targets.length; i++) {
			var urlPath = url.parse(req.url).pathname;
			// Allow exact URL string or regex(-ish) match
			if (targets[i].url === urlPath || targets[i].url.test && targets[i].url.test(urlPath)) {
				// If no files are named explicitly, attempt to resolve the file requested of the server.
				// NOTE: NOT SAFE! This doesn't check for malicious paths, as it is only intended for dev use.
				var files = resolveFilePaths(root, targets[i].files || urlPath.replace(/^\//, ''));
				sendThroughPipes(files, targets[i].factories || [], res, next, urlPath);
				return;
			}
		}
		// If no match, forward to next middleware
		next();
	};
}

module.exports = resourcePipeline;
