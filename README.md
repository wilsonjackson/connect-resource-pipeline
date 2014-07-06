connect-preprocess
==================

Middleware for Connect to allow arbitrary preprocessing (with streams!)

This middleware was written to support development with [gulp.js](http://gulpjs.com/), and is not at all (not even a
little bit) intended to be used standalone or in any kind of production capacity. So don't do that.

Instead, do this:

```js
var gulp = require('gulp');
var connect = require('gulp-connect');
var preprocess = require('../connect-preprocess');
var less = require('gulp-less');

gulp.task('serve', function () {
	connect.server({
		root: 'public',
		middleware: function (connect) {
			return [
				// Use the preprocess middleware
				connect().use(preprocess({root: 'public'}, [
					// Define URLs to match and map them to globs (that are automatically concatenated)
					{url: '/all.js', files: ['js/*.js']},
					// Pipe through your favorite gulp plugins!
					{url: '/styles.css', files: ['less/*.less'], factories: [less]}
				]))
			];
		}
	});
});
```

API
---

### preprocess([options, ] targets)

#### `options`

An object which may contain:

- `path`: Will be used to prefix all non-absolute paths in `files`, or the URL path if `files` is empty.

#### `targets`
 
An array that defines URLs to be matched and what to return as a response. Each entry is an object comprised of:

- `url`: The URL to match. May be a string or a regex. Matched against `url.parse(req.url).pathname`.
- `files` (optional): A string or array of strings containing file paths to match. Uses `vinyl-fs` under the hood, so
  globs are allowed. If omitted, the `pathname` of the request will be used.
- `factories` (optional): An array of factories that produce processors (gulp plugins). The matched `files` will be
  piped through each factory's plugin, in order, before being concatenated and sent as a response.


Not quite the same as piping to plugins during a build
------------------------------------------------------

If you're particularly attentive, you may have noticed in the above example that the less plugin is not _invoked_ before
it is assigned into the `factories` array. This is by design, as it's common practice for gulp plugins not to be written
with re-use in mind; they're meant to be invoked, piped to, and forgotten. As such, reusing a plugin may have unintended
side effects.

To accommodate this, plugins are provided to `preprocess` as `factories`. Normally a factory is just a reference to the
plugin function, as above. If you need to pass arguments to the plugin, use `bind` like so:

```js
{
	url: '/styles.css',
	files: ['less/*.less'],
	factories: [less.bind(null, {paths: ['public/less/includes']})]
}
```

Connect compatibility
---------------------

This has only been tested with the 2.0 line of Connect.

Rationale
---------

Sometimes doing neat things with your build makes running a local development server harder. Wouldn't it be nice if you
could use the same plugins your build uses as part of a dynamic dev server? Yes, it would.

License
-------

View the [LICENSE](https://github.com/wilsonjackson/connect-preprocess/blob/master/LICENSE) file.
