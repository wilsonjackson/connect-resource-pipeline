var gulp = require('gulp');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');

var options = {
	srcFiles: 'index.js',
	testFiles: 'test/spec.js'
};

gulp.task('lint', function () {
	return gulp.src(options.srcFiles)
		.pipe(jshint());
});

gulp.task('test', ['lint'], function () {
	return gulp.src(options.testFiles)
		.pipe(mocha());
});

gulp.task('test-coverage', ['lint'], function (cb) {
	gulp.src(options.srcFiles)
		.pipe(istanbul())
		.on('finish', function () {
			gulp.src(options.testFiles)
				.pipe(mocha())
				.pipe(istanbul.writeReports())
				.on('end', cb);
		});
});
