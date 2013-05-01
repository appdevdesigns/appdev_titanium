var project = require('../project.js');
module.exports.operationStack = [
    project.enumResources,
    project.update,
    project.prune,
    project.augmentGitIgnore
];

module.exports.COA = {
    name: 'update',
    title: 'Update project',
    opts: ['copy'],
    definitions: {
        opts: [{
            name: 'copy',
            title: 'Copy files',
            short: 'c',
            long: 'copy',
            flag: true
        }]
    }
};
