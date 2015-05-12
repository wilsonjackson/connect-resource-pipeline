var path = require('path');
var url = require('url');
var mime = require('mime');
var vinyl = require('vinyl-fs');
var through = require('through2');
var terminus = require('terminus');

function createPipelineFromFactories(factories) {
    return function (stream) {
        factories.forEach(function (factory) {
            // Send matched files through user-defined pipes
            stream = stream.pipe(factory());
        });
        return stream;
    };
}

function sendThroughPipeline(files, pipeline, req, send, next, urlPath, mimeType) {
    var numFiles = 0;
    pipeline(vinyl.src(files), req)
        .pipe(through.obj(function (file, enc, callback) {
            // Count files to detect an empty stream
            ++numFiles;
            // Replace Vinyl File with Buffer
            this.push(file.contents);
            callback();
        }))
        .pipe(terminus.concat(function (content) {
            if (numFiles > 0) {
                if (!mimeType) {
                    mimeType = mime.lookup(urlPath);
                }
                var charset = mime.charsets.lookup(mimeType);
                send(mimeType, charset, content);
            }
            else {
                // If no files were matched, forward to next middleware (but issue a warning)
                console.warn(
                    'connect-resource-pipeline matched URL "' + urlPath + '" but found no files matching [' +
                    files + ']');
                next();
            }
        }));
}

function sendRequest(res, mimeType, charset, content) {
    res.setHeader('Content-Type', mimeType + (charset ? '; charset=' + charset : ''));
    res.end(content);
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
    if (Array.isArray(options)) {
        targets = options;
        options = {};
    }
    var root = options.root || path.join('.', '');
    var indexFile = options.indexFile || 'index.html';
    var cache = {};

    if (!targets.every(function (target) {return !target.factories;})) {
        console.warn('\033[31mconnect-resource-pipeline: "factories" property is deprecated\033[0m');
    }

    var middleware = function (req, res, next) {
        for (var i = 0; i < targets.length; i++) {
            var urlPath = url.parse(req.url).pathname;
            if (urlPath.substr(-1) === '/') {
                urlPath += indexFile;
            }
            var targetUrl = targets[i].url;
            if (typeof targetUrl === 'string' && targetUrl.substr(-1) === '/') {
                targetUrl += indexFile;
            }
            // Allow exact URL string or regex(-ish) match
            if (targetUrl === urlPath || targetUrl.test && targetUrl.test(urlPath)) {
                var cacheKey = targets[i].cache;
                if (cacheKey === true) {
                    cacheKey = targetUrl.toString();
                }
                // Check cache for content
                if (cacheKey && cache[cacheKey]) {
                    var entry = cache[cacheKey];
                    sendRequest(res, entry.mimeType, entry.charset, entry.content);
                }
                else {
                    // If no files are named explicitly, attempt to resolve the file requested of the server.
                    // NOTE: NOT SAFE! This doesn't check for malicious paths, as it is only intended for dev use.
                    var files = resolveFilePaths(root, targets[i].files || urlPath.replace(/^\//, ''));
                    var pipeline = targets[i].pipeline || createPipelineFromFactories(targets[i].factories || []);
                    var send = createSendFn(cacheKey);
                    sendThroughPipeline(files, pipeline, req, send, next, urlPath, targets[i].mimeType);
                }
                return;
            }
        }

        // If no match, forward to next middleware
        next();

        function createSendFn(cacheKey) {
            return function (mimeType, charset, content) {
                if (cacheKey) {
                    cache[cacheKey] = {
                        mimeType: mimeType,
                        charset: charset,
                        content: content
                    };
                }
                sendRequest(res, mimeType, charset, content);
            };
        }
    };

    middleware.clear = function (cacheKey) {
        cache[cacheKey] = null;
    };

    return middleware;
}

module.exports = resourcePipeline;
