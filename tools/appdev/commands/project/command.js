var project = null;
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

var coa = require('coa');
// Add a custom command function that is used by all subcommands
coa.Cmd.prototype.project = function() {
    return this.arg()
        .name('project').title('Project')
        .req() // argument is required
        .end(); // end argument definition
};

module.exports.load = function() {
    project = require('./project.js');
};

module.exports.COA = function() {
    this.title('Manage AppDev Titanium projects').helpful()
        .cmd() // inplace subcommand definition
            .name('create').title('Create project').helpful()
            .act(makeAction('create'))
            .project()
            .end() // end subcommand definition
        .cmd() // inplace subcommand definition
            .name('update').title('Update project').helpful()
            .act(makeAction('update'))
            .project()
            .opt()
                .name('copy').title('Copy files')
                .short('c').long('copy')
                .flag() // option requires no value
                .end()
            .end() // end subcommand definition
        .cmd() // inplace subcommand definition
            .name('clean').title('Clean project').helpful()
            .act(makeAction('clean'))
            .project()
            .end(); // end subcommand definition
};
