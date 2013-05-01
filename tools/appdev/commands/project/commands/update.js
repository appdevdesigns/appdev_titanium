var project = require('../project.js');
module.exports.operationStack = [
    project.enumResources,
    project.update,
    project.prune,
    project.augmentGitIgnore
];

module.exports.COA = {
    name: 'update',
    title: 'Update project'
};
