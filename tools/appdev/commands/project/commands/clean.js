var project = require('../project.js');
module.exports.operationStack = [
    project.clean,
    project.prune,
    project.gitIgnore
];

module.exports.COA = function() {
    return this.name('clean').title('Clean project').helpful()
        .project();
};
