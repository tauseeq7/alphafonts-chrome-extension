#!/usr/bin/env node
// Kept so the old command still works: node firefox/package.js
// (the real packager is tools/package.js)
require('../tools/package.js').build('firefox');
