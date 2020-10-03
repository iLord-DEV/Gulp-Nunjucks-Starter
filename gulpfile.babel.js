import {
  src,
  dest,
  watch,
  series,
  parallel
} from 'gulp'
import postcss from 'gulp-postcss'
import sourcemaps from 'gulp-sourcemaps'
import autoprefixer from 'autoprefixer'
import yargs from 'yargs'
import sass from 'gulp-sass'
import cleanCss from 'gulp-clean-css'
import gulpif from 'gulp-if'
import imagemin from 'gulp-imagemin'
import del from 'del'
import webpack from 'webpack-stream'
import named from 'vinyl-named'
import browserSync from 'browser-sync'
import svgSprite from 'gulp-svg-sprite'
import nunjucksRender from 'gulp-nunjucks-render'
import data from 'gulp-data'
import fs from 'fs'

const PRODUCTION = yargs.argv.prod
const page_data = './src/data/page_data.json'



export const copy = () => {
  return src([
    'src/assets/**/*',
    '!src/assets/{images,svg}'
  ]).pipe(dest('./dist/assets'))
}

export const njkHTML = () => {
  var njkDefaults = {
    ext: '.html',
    path: 'src/'
  };

  return (src(['src/*.+(html|njk)'])
    // .pipe(data(page_data))
    .pipe(data(function (file) {
      return JSON.parse(fs.readFileSync(page_data, 'utf8'));
    }))
    .pipe(nunjucksRender(njkDefaults))
    .pipe(dest('./dist/')))
}

export const njkPHP = () => {
  var njkDefaults = {
    ext: '.php',
    path: 'src/'
  };
  return (src(['src/*.php'])
    // .pipe(data(page_data))
    .pipe(data(function (file) {
      return JSON.parse(fs.readFileSync(page_data, 'utf8'));
    }))
    .pipe(nunjucksRender(njkDefaults))
    .pipe(dest('./dist/')))
}



export const clean = () => del(['dist'])

// sprite svg call manually
export const svg = () => {
  const config = {
    shape: {
      dimension: {
        // Set maximum dimensions
        maxWidth: 32,
        maxHeight: 32
      },

      dest: 'files/intermediate-svg' // Keep the intermediate files
    },
    mode: {
      view: {
        // Activate the «view» mode
        bust: false,
        render: {
          scss: true // Activate Sass output (with default options)
        }
      },

      symbol: {
        dest: '.',
        example: true,
        sprite: 'main.svg'
      },

      defs: true
    }
  }

  return src('**/*.svg', {
      cwd: 'src/svg'
    })
    .pipe(svgSprite(config))
    .pipe(dest('./dist/assets/svg'))
}

export const styles = () => {
  return (
    src(['src/sass/main.scss', 'src/sass/admin.scss'])
    .pipe(gulpif(!PRODUCTION, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(gulpif(PRODUCTION, postcss([autoprefixer])))
    .pipe(gulpif(PRODUCTION, cleanCss({
      compatibility: '*'
    })))
    .pipe(gulpif(!PRODUCTION, sourcemaps.write()))
    .pipe(dest('./dist/css'))

    .pipe(server.stream())
  )
}

const server = browserSync.create()
export const serve = (done) => {
  server.init({
    proxy: {
      target: 'http://quelle.test'
    },
    notify: true,
    scrollThrottle: 100
  })
  done()
}
export const reload = (done) => {
  server.reload()
  done()
}

export const scripts = () => {
  return src(['src/js/*.js'])
    .pipe(named())
    .pipe(
      webpack({
        module: {
          rules: [{
            test: /\.js$/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: []
              }
            }
          }]
        },
        mode: PRODUCTION ? 'production' : 'development',
        devtool: !PRODUCTION ? 'inline-source-map' : false,
        output: {
          filename: '[name].js'
        },
        externals: {
          jquery: 'jQuery'
        }
      })
    )
    .pipe(dest('dist/js'))
}



export const images = () => {
  return src('src/assets/images/**/*.{jpg,jpeg,png,gif}')
    .pipe(gulpif(PRODUCTION, imagemin()))
    .pipe(dest('dist/assets/images'))
}

export const watchForChanges = () => {
  watch('src/sass/**/*.scss', styles)
  watch('src/**/*.njk', series(njkHTML, reload))
  watch('src/svg/*.svg', series(svg, reload))
  watch('src/assets/images/**/*.{jpg,jpeg,png,gif}', series(images, reload))
  watch('src/js/**/*.js', series(scripts, reload))
  watch('**/*.php', series(njkPHP, reload))
  watch('src/data/page_data.json', series(njkHTML, njkPHP, reload))
}



export const dev = series(

  series(njkHTML, njkPHP, svg, parallel(copy, images, styles, scripts)),
  serve,
  watchForChanges
)
export const build = series(

  parallel(njkHTML, njkPHP, copy, styles, svg, images, scripts)
)
export default dev