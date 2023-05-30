#!/usr/bin/env node
const { promises: fs } = require('fs');
const path = require('path');
const globby = require('globby');
const { yellow, red } = require('chalk');

(async () => {
  let hasErrors = false;
  let files = [];
  let [usePackage, patterns] = process.argv.slice(2).reduce(
    ([_usePackage, _patterns], arg) => {
      return arg === '--package' ? [true, _patterns] : [_usePackage, [..._patterns, arg]];
    },
    [false, []]
  );

  if (patterns.length === 0 && !usePackage) {
    console.error(
      `
Usage: chmodx [--package] "<glob>" ["<glob>"...]

Sets the executable bit on all files which match the glob patterns. Put glob
patterns in quotes so that chmodx can expand them. Always use forward slashes
in glob patterns (even in Windows).

Options:
  --package  Set the executable bit for all files referenced in "bin" section
             of the package.json file in the current directory. The "bin"
             value or values must be file paths (e.g. "./src/index.js").
      `.trim() + '\n'
    );
    process.exit(1);
  }

  if (patterns.length > 0) {
    files = [
      ...files,
      ...(await globby(patterns, {
        expandDirectories: false,
        onlyFiles: true,
      })),
    ];
  }

  if (usePackage) {
    try {
      const bin = JSON.parse(await fs.readFile('package.json', 'utf8')).bin;

      files = [
        ...files,
        ...(bin == null ? [] : typeof bin === 'string' ? [bin] : Object.keys(bin).map((name) => bin[name])),
      ];
    } catch (err) {
      console.error(yellow(`${err}`));
      hasErrors = true;
    }
  }

  files = files.map((file) => path.relative(process.cwd(), path.resolve(file)));
  files = [...new Set(files)];
  files = files.sort();

  for (const file of files) {
    try {
      const stats = await fs.stat(file);

      if ((stats.mode & 0o111) !== 0o111) {
        await fs.chmod(file, stats.mode | 0o111);
      }
    } catch (err) {
      hasErrors = true;
      console.error(yellow(`${err}`));
    }
  }

  process.exit(hasErrors ? 1 : 0);
})().catch((err) => {
  console.error(red(`${(!!process.env.DEBUG && err.stack) || err}`));
  process.exit(1);
});
