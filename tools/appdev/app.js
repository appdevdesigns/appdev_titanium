#! /usr/bin/env node

var argv = process.argv.slice(2);
var coa = require('coa');
require('commands.js').rootCommand
    .name(process.argv[1])
    .title('AppDev Titanium command line tool')
    .helpful()
    .loadCommands(__dirname)
    .end()
.run(argv.length ? argv : ['-h']);
