connect-resource-pipeline
=========================

[![Build Status](https://travis-ci.org/wilsonjackson/connect-resource-pipeline.svg?branch=master)](https://travis-ci.org/wilsonjackson/connect-resource-pipeline)

Middleware for Connect to allow resource transformation via streams.

This middleware was written to support development with [gulp.js](http://gulpjs.com/), and is not at all (not even a
little bit) intended to be used standalone or in any kind of production capacity. So don't do that.

Instead, do this:

```js
var gulp = require('gulp');
var connect = require('connect');
var pipeline = require('connect-resource-pipeline');
var less = require('gulp-less');

gulp.task('serve', function () {
    var app = connect();
    app.use(pipeline({root: 'public'}, [
        // Define URLs to match and map them to globs (that are automatically concatenated)
        {url: '/all.js', files: ['js/*.js']},
        // Pipe through your favorite gulp plugins!
        {url: '/styles.css', files: ['less/*.less'], pipeline: function (files) {
            return files.pipe(less());
        }}
    ]));
    app.listen(8080);
});
```

Installation
------------

```
npm i connect-resource-pipeline --save
```

API
---

### var middleware = pipeline([options, ] targets)

#### `options`

An object which may contain:

- `root`

    Type: `string`

    Will be used to prefix all non-absolute paths in `files`, or the URL path if `files` is empty.

#### `targets`
 
An array that defines URLs to be matched and what to return as a response. Each entry is an object comprised of:

- `url`

    Type: `string|RegExp`

    The URL to match. Matched against `url.parse(req.url).pathname`.

- `cache` (optional)

    Type: `string|boolean`

    Enables caching of pipeline output. Set to `true` to enable with the URL used as the cache key, or any `string` to
    enable with `string` used as the cache key.

- `files` (optional)

    Type: `string|string[]`

    File paths to match. Uses `vinyl-fs` under the hood, so globs are allowed. If omitted, the `pathname` of the
    request will be used.

- `mimeType` (optional)

    Type: `string`
    
    Mime type to send in the response headers. If omitted, a mime type will be guessed using the
    [mime module](https://github.com/broofa/node-mime), based on the matched URL.

- `pipeline` (optional)

    Type: `function(stream.Readable, Request): stream.Readable`

    A function that takes a stream of files as an argument and returns the result stream. The request object is passed
    as the second argument.

- ___DEPRECATED___ `factories` (optional)

    An array of factories that produce processors (gulp plugins). The matched `files` will be
    piped through each factory's plugin, in order, before being concatenated and sent as a response.
    
    _This functionality has been deprecated in favor of the far more flexible and gulp-like `pipeline` property._

### middleware.clear([cacheKey])

Clear the contents of `cacheKey` in the internal cache.

Caching
-------

If you want to cache output and retain the ability to clear the cache (for example within a watch), save a reference to
the middleware instance you pass to `app.use()`.

```js
var gulp = require('gulp');
var connect = require('connect');
var pipeline = require('connect-resource-pipeline');

gulp.task('serve', function () {
    var middleware = pipeline([
        {url: '/all.js', cache: 'js', files: ['public/js/*.js']}
    ]);

    gulp.watch('public/js/*.js', function () {
        middleware.clear('js');
    });

    var app = connect();
    app.use(middleware);
    app.listen(8080);
});
```

Connect compatibility
---------------------

This has been tested with Connect 2.x and 3.x.

Rationale
---------

Sometimes doing neat things with your build makes running a local development server harder. Wouldn't it be nice if you
could use the same plugins your build uses as part of a dynamic dev server? Yes, it would.
