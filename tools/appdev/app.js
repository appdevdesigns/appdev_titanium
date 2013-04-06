#! /usr/bin/env node

var async = require('async');
var argv = process.argv.slice(2);
var coa = require('coa');
var cmd = coa.Cmd().name(process.argv[1]).title('AppDev Titanium command line tool').helpful()
    .cmd() // inplace subcommand definition
        .name('install').title('Install dependencies').helpful()
        .act(function() {
            var npm = require('npm');
            npm.load({}, function(err) {
                if (err) throw err;
                
                async.each(commands, function(command, callback) {
                    npm.localPrefix = command.directory;
                    npm.commands.update([], callback);
                }, function(err) {
                	if (err) throw err;
                });
            });
            // Echo npm output to the console
            npm.on('log', function(message) {
                console.log(message);
            });
        })
        .end(); // end subcommand definition

var path = require('path');
var commands = null;
var commandsDir = path.join(__dirname, 'commands');

var fs = require('fs');
fs.readdir(commandsDir, function(err, files) {
    if (err) throw err;
    
    commands = files.map(function(command) {
        var commandDir = path.join(commandsDir, command);
        return {
            name: command,
            directory: commandDir,
            path: path.join(commandDir, 'command.js')
        };
    });
    commands.forEach(function(command) {
        cmd.cmd().name(command.name).apply(require(command.path).COA).end(); // load subcommand from module
    });
    cmd.end().run(argv.length ? argv : ['-h']);
});
