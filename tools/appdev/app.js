#! /usr/bin/env node

var argv = process.argv.slice(2);
var coa = require('coa');
var cmd = coa.Cmd().name(process.argv[1]).title('AppDev Titanium command line tool').helpful();

var path = require('path');
var commands = null;
var commandsDir = path.join(__dirname, 'commands');

var fs = require('fs');
fs.readdir(commandsDir, function(err, files) {
    if (err) throw err;
    
    commands = files.map(function(command) {
        return {
            name: command,
            path: path.join(commandsDir, command, 'command.js')
        };
    });
    commands.forEach(function(command) {
        cmd.cmd().name(command.name).apply(require(command.path).COA).end(); // load subcommand from module
    });
    cmd.end().run(argv.length ? argv : ['-h']);
});
