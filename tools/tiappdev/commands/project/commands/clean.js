var async = require('async');
var fs = require('fs-extra');
var path = require('path');

var compareVersions = function(v1, v2) {
    var v1Parts = v1.split('.');
    var v2Parts = v2.split('.');
    var maxLength = Math.max(v1Parts.length, v2Parts.length);
    for (var i = 0; i < maxLength; ++i) {
        var v1Part = parseInt(v1Parts[i], 10) || 0;
        var v2Part = parseInt(v2Parts[i], 10) || 0;
        if (v1Part > v2Part) {
            return 1;
        }
        else if (v1Part < v2Part) {
            return -1;
        }
    }
    return 0;
};

var cleaniOSSimulatorApp = function(params, callback) {
    var appName = params.project+'.app';
    var simulatorPath = path.join(process.env.HOME, 'Library', 'Application Support', 'iPhone Simulator');
    var applicationsPath = null;
    async.waterfall([
        function(callback) {
            fs.readdir(simulatorPath, callback);
        },
        function(versions, callback) {
            // Determine the largest simulator version
            var version = versions.reduce(function(version1, version2) {
                return compareVersions(version1, version2) > 0 ? version1 : version2;
            });
            applicationsPath = path.join(simulatorPath, version, 'Applications');
            fs.readdir(applicationsPath, callback);
        },
        function(applications, callback) {
            // Resolve the application paths
            var applicationPaths = applications.map(function(application) {
                return path.join(applicationsPath, application, appName);
            });
            // Filter the applications to determine which ones are associated
            // with the project (should normally be only one). These application
            // will contain a <project>.app file in their root directory.
            async.filter(applicationPaths, fs.exists, function(projectApps) {
                callback(null, projectApps);
            });
        },
        function(projectApps, callback) {
            // Remove the associated apps that are associated with the project
            var projects = projectApps.map(function(projectApp) {
                console.log('remove'.red, projectApp.info);
                return path.resolve(projectApp, '..');
            });
            async.each(projects, fs.remove, callback);
        }
    ], callback);
};
cleaniOSSimulatorApp.flag = 'application';

// Remove the "build" directory from the project
var cleanBuildDir = function(params, callback) {
    var buildDir = path.join(params.projectDir, 'build');
    console.log('remove'.red, path.relative(params.titaniumDir, buildDir).info);
    fs.remove(buildDir, callback);
};
cleanBuildDir.flag = 'build';

module.exports.operationStack = [
    'enumResources',
    'clean',
    'prune',
    'cleanGitIgnore',
    cleaniOSSimulatorApp,
    cleanBuildDir
];
module.exports.COA = {
    name: 'clean',
    title: 'Clean project',
    definitions: {
        opts: [{
            name: 'application',
            title: 'Clean iOS simulator application',
            short: 'a',
            long: 'application',
            flag: true,
        }, {
            name: 'build',
            title: 'Clean build directory',
            short: 'b',
            long: 'build',
            flag: true
        }]
    }
};
