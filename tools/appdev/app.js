#! /usr/bin/env node

var colors = require('colors');
colors.setTheme({
    error: 'red',
    hint: 'cyan',
    label: 'blue',
    info: 'cyan'
});

var argv = process.argv.slice(2);
require('commands.js').rootCommand
    .name(process.argv[1])
    .title('AppDev Titanium command line tool')
    .helpful()
    .loadCommands({
        rootDirectory: __dirname
    })
    .end()
.run(argv.length ? argv : ['-h']);
