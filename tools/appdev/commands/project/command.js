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
            return this
                .arg()
                    .name('project').title('Project')
                    .req() // argument is required
                    .end() // end argument definition
                .opt()
                    .name('resources').title('Do not manipulate resources')
                    .short('R').long('no-resources')
                    .flag() // option has no value
                    .end()
                .opt()
                    .name('prune').title('Do not prune dead symbolic links')
                    .short('P').long('no-prune')
                    .flag() // option has no value
                    .end()
                .opt()
                    .name('gitignore').title('Do not manipulate .gitignore')
                    .short('G').long('no-gitignore')
                    .flag() // option has no value
                    .end();
        }
    });
};
