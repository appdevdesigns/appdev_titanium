var project = require('../project.js');
module.exports.operationStack = [
    project.update,
    project.prune,
    project.gitIgnore
];

module.exports.COA = function() {
    return this.name('update').title('Update project').helpful()
        .project()
        .opt()
            .name('copy').title('Copy files')
            .short('c').long('copy')
            .flag() // option requires no value
            .end();
};
