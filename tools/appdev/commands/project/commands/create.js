var project = require('../project.js');
module.exports.operationStack = [
    project.enumResources,
    project.create,
    project.update,
    project.prune,
    project.augmentGitIgnore
];

module.exports.COA = {
    name: 'create',
    title: 'Create project'
};
