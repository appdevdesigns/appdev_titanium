var project = null;

module.exports.load = function() {
    project = require('./project.js');
};

module.exports.COA = function() {
    this.title('Manage AppDev Titanium projects').helpful().loadCommands({
        rootDirectory: __dirname,
        setupStack: project.setupStack,
        coaPreProcess: function() {
            // This callback is called for each subcommand that was loaded
            
            // Add a project argument to all subcommands
            return this.arg()
                .name('project').title('Project')
                .req() // argument is required
                .end(); // end argument definition
        }
    });
};
