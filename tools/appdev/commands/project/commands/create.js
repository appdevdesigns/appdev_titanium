var project = require('../project.js');
module.exports.operationStack = [
    project.create,
    project.update,
    project.prune,
    project.augmentGitIgnore
];

module.exports.COA = function() {
    return this.name('create').title('Create project').helpful();
};
