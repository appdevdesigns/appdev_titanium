#! /usr/bin/env node

var project = require('./project.js');
var Q = require('q');

var extend = function(base) {
    Array.prototype.slice.call(arguments, 1).forEach(function(object) {
        // Copy properties from object to base
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                base[key] = object[key];
            }
        }
    });
    return base;
};

var makeAction = function(command) {
    return function(opts, args, res) {
        var params = extend({}, opts, args);
        return Q.nfcall(project[command], params).then(function() {
            // Suppress output
            return null;
        });
    };
};

var argv = process.argv.slice(2);
var coa = require('coa');
coa.Cmd.prototype.addProjectArg = function() {
    return this.arg()
        .name('project').title('Project')
        .req() // argument is required
        .end(); // end argument definition
};
coa.Cmd()
    .name(process.argv[1]).title('AppDev Titanium project manager').helpful()
    .cmd() // inplace subcommand definition
        .name('create').title('Create project').helpful()
        .act(makeAction('create'))
        .addProjectArg()
        .end() // end subcommand definition

    .cmd() // inplace subcommand definition
        .name('update').title('Update project').helpful()
        .act(makeAction('update'))
        .addProjectArg()
        .opt()
            .name('copy').title('Copy files')
            .short('c').long('copy')
            .flag() // option requires no value
            .end()
        .end() // end subcommand definition
    .cmd() // inplace subcommand definition
        .name('clean').title('Clean project').helpful()
        .act(makeAction('clean'))
        .addProjectArg()
        .end() // end subcommand definition
    .run(argv.length ? argv : ['-h']);
