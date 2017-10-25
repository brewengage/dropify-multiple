var gulp = require('gulp');
var $    = require('gulp-load-plugins')();
var pkg = require('./package.json');
var cleanCSS = require('gulp-clean-css');

var argv = require('minimist')(process.argv.slice(2));

var jsDir     = 'src/js/',
    sassDir   = 'src/sass/',
    fontsDir  = 'src/fonts/',
    distDir   = 'dist',
    banner    = [
        '/*!',
        ' * <%= pkg.name %> - <%= pkg.description %>',
        ' * @version v<%= pkg.version %>',
        ' * @link <%= pkg.homepage %>',
        ' * @author <%= pkg.author %>',
        ' * @contributors <%= pkg.contributors[0] %>',
        ' * @contributors BrewEngage (added support for multi file upload)',
        ' * @license <%= pkg.license %>',
        ' */\n\n'
    ].join('\n'),
    umdDeps = {
        dependencies: function() {
            return [
                {
                    name: '$',
                    amd: 'jquery',
                    cjs: 'jquery',
                    global: 'jQuery',
                    param: '$'
                }
            ];
        },
        exports: function(file) {
            return 'DropifyMultiple';
        },
        namespace: function(file) {
            return 'DropifyMultiple';
        }
    };

var onError = function (err) {
    $.util.beep();
    console.log(err.toString());
    this.emit('end');
};

gulp.task('fonts', function() {
    return gulp
        .src(fontsDir + '**/*')
        .pipe(gulp.dest(distDir + "/fonts"))
    ;
});

gulp.task('sass', function() {
    return gulp
        .src(sassDir + '*.scss')
        .pipe($.plumber({ errorHandler: onError }))
        .pipe($.sass())
        .pipe($.autoprefixer())

        .pipe($.header(banner, { pkg: pkg} ))
        .pipe(gulp.dest(distDir + "/css"))

        // .pipe($.if(!argv.dev, $.minifyCss()))
        .pipe(cleanCSS({compatibility: 'ie8'}))

        .pipe($.if(!argv.dev, $.rename(pkg.name + '.min.css')))
        .pipe($.if(!argv.dev, gulp.dest(distDir + "/css")))
    ;
});

gulp.task('scripts', function() {
    return gulp
        .src([jsDir + '*.js'])
        .pipe($.plumber({ errorHandler: onError }))
        .pipe(gulp.dest(distDir + "/js"))
        .pipe($.umd(umdDeps))

        .pipe($.header(banner, { pkg : pkg }))
        .pipe($.rename(pkg.name + '.js'))
        .pipe(gulp.dest(distDir + "/js"))

        .pipe($.if(!argv.dev, $.uglify()))
        //.pipe($.if(!argv.dev, $.header(banner, { pkg : pkg })))
        .pipe($.if(!argv.dev, $.rename(pkg.name + '.min.js')))
        .pipe($.if(!argv.dev, gulp.dest(distDir + "/js")))
    ;
});


gulp.task('default', ['sass', 'scripts', 'fonts'], function() {
    gulp.watch(jsDir + '**/*.js', ['scripts']);
    gulp.watch(sassDir + '**/*.scss', ['sass']);
});

gulp.task('build', ['sass', 'scripts', 'fonts']);
