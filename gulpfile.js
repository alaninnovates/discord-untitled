const gulp = require('gulp');
const gulpTS = require('gulp-typescript');
const gulpSourceMaps = require('gulp-sourcemaps');
const del = require('del');
const path = require('path');
const { execSync } = require('child_process');

const project = gulpTS.createProject('tsconfig.json');

let _linter;
let _gulpTSLint;
let _tslint;
let _runSequence;

const runSequence = () => _runSequence = _runSequence || require('run-sequence');
const gulpTSLint = () => _gulpTSLint = _gulpTSLint || require('gulp-tslint');
const tslint = () => _tslint = _tslint || require('tslint');
const linter = () => _linter = _linter || tslint().Linter.createProgram('tsconfig.json');

gulp.task('default', ['build']);
gulp.task('build:vscode', cb => runSequence()('lint', 'build', cb));

gulp.task('pause', cb => setTimeout(() => cb(), 1e3));
gulp.task('tests', cb => runSequence()('lint', 'build', 'pause', 'build:tests', cb));

gulp.task('lint', () => {
	gulp.src('src/**/*.ts')
		.pipe(gulpTSLint()({
			configuration: 'tslint.json',
			formatter: 'prose',
			program: linter()
		}))
		.pipe(gulpTSLint().report());
});

gulp.task('build', () => {
	del.sync(['dist/**/*.*']);
	const tsCompile = gulp.src('src/**/*.ts')
		.pipe(gulpSourceMaps.init({ base: 'src' }))
		.pipe(project());

	tsCompile.pipe(gulp.dest('dist/'));

	gulp.src('src/**/*.js').pipe(gulp.dest('dist/'));
	gulp.src('src/**/*.json').pipe(gulp.dest('dist/'));
	
	return tsCompile.js
		.pipe(gulpSourceMaps.mapSources(sourcePath => path.join(__dirname, 'src', sourcePath)))
		.pipe(gulpSourceMaps.write())
		.pipe(gulp.dest('dist/'));
});

gulp.task('build:tests', () => {
	del.sync(['test/**/*.js']);
	const tsCompile = gulp.src('test/**/*.ts')
		.pipe(gulpSourceMaps.init({ base: 'test' }))
		.pipe(project());

	tsCompile.pipe(gulp.dest('test/'));

	return tsCompile.js
		.pipe(gulpSourceMaps.mapSources(sourcePath => path.join(__dirname, 'test', sourcePath)))
		.pipe(gulpSourceMaps.write())
		.pipe(gulp.dest('test/'));
});
