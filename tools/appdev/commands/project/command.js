var project = require('./project.js');

module.exports.load = project.load;

module.exports.COA = {
    title: 'Manage AppDev Titanium projects',
    loadCommands: {
        rootDirectory: __dirname,
        setupStack: project.setupStack
    },
    definitions: {
        args: [{
            name: 'project',
            title: 'Project',
            req: true
        }],
        opts: [{
            name: 'copy',
            title: 'Copy files',
            short: 'c',
            long: 'copy',
            flag: true
        }, {
            name: 'resources',
            title: 'Do not manipulate resources',
            short: 'R',
            long: 'no-resources',
            flag: true
        }, {
            name: 'prune',
            title: 'Do not prune dead symbolic links',
            short: 'P',
            long: 'no-prune',
            flag: true
        }, {
            name: 'gitignore',
            title: 'Do not manipulate .gitignore',
            short: 'G',
            long: 'no-gitignore',
            flag: true
        }]
    },
    inherited: ['project'],
    operations: project.operations
};
