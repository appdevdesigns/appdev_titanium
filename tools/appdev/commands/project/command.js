var project = null;

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
    this.title('Manage AppDev Titanium projects').helpful().loadCommands({
        rootDirectory: __dirname,
        setupStack: project.setupStack
    });
};
