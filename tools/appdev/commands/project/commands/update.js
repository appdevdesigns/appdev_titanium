var project = require('../project.js');
module.exports.operationStack = [
    project.enumResources,
    project.update,
    project.prune,
    project.augmentGitIgnore
];

module.exports.COA = function() {
    return this.name('update').title('Update project').helpful()
        .opt()
            .name('copy').title('Copy files')
            .short('c').long('copy')
            .flag() // option requires no value
            .end();
};
