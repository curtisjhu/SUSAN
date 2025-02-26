const esbuild = require("esbuild");
const fse = require("fs-extra");
var minify = require('html-minifier').minify;
const { src, dest  } = require('gulp');


// JS
esbuild.buildSync({
	entryPoints: ["script.js"],
	bundle: true,
	minify: true,
	treeShaking: true,
	outdir: "dist",
	format: "esm",
	allowOverwrite: true,
	splitting: false,
});

// CSS
fse.copyFileSync("embedmain.css", "./dist/embedmain.css")
fse.copySync("models", "dist/models", {})

// HTML
src('index.html')
	.on('data', function(file) {
		const bufferFile = Buffer.from(minify(file.contents.toString(), {
			collapseWhitespace: true,
			removeComments: true,
			minifyJS: true,
		}))
      	return file.contents = bufferFile
	})
	.pipe(dest('dist'));
