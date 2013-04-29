var project = null;

module.exports.load = function() {
    project = require('./project.js');
};

module.exports.COA = {
    title: 'Manage AppDev Titanium projects',
    loadCommands: {
        rootDirectory: __dirname,
        get setupStack() {
            return project.setupStack;
        }
    },
    definitions: {
        args: [{
            name: 'project',
            title: 'Project',
            req: true
        }],
        opts: [{
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
    inherited: ['project', 'resources', 'prune', 'gitignore']
};
