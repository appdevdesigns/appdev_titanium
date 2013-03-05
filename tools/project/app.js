#! /usr/bin/env node

var args = process.argv.slice(2);

// Get and validate the verb argument
var verb = args[0];
var verbs = ['create', 'update', 'clean'];
if (verbs.indexOf(verb) === -1) {
    throw 'Invalid verb ['+verb+']!  Valid verbs: '+verbs.join(', ');
}
var operation = verb; // alias

// Get the project argument
var project = args[1];

// Print the currently executing command
console.log(verb, project);

// Load required modules
var path = require('path');
var fs = require('fs');
var async = require('async');

// Calculate the paths of the AppDev, and Titanium, and project directories
var appDevDir = path.resolve(__dirname, '../../');
var titaniumDir = path.resolve(appDevDir, '../');
var projectDir = path.resolve(titaniumDir, project);
var projectResourcesDir = path.resolve(projectDir, 'Resources');
console.log('Titanium directory: '+titaniumDir);
console.log('AppDev directory: '+appDevDir);
console.log('Project directory: '+projectDir);
console.log('\n');

// Return a function to suppress errors of the types found in the errors array
var suppressErrors = function(errors, callback) {
    return function(err) {
        callback((err && errors.indexOf(err.code) === -1) ? err : null);
    };
};

// Create the project
var createProject = function(callback) {
    var wrench = require('wrench');
    async.series([
        function(callback) {
            // Create the project root directory
            // It is OK if the directory already exists
            fs.mkdir(projectDir, suppressErrors(['EEXIST'], callback));
        },
        function(callback) {
            // Copy the template files to the project
            wrench.copyDirRecursive(path.join(appDevDir, 'templates'), projectDir, callback);
        }
    ], callback);
};

// Create/update/remove a symbolic link to allow the project to reference AppDev resources
var updateLink = function(destination, callback) {
    // Calculate the source, where the link is located
    var source = path.join(projectResourcesDir, destination);

    // Calculate the target, what the link will point to
    var target = path.join(appDevDir, destination);

    console.log(source, '->', target);

    async.series([
        function(callback) {
            if (operation === 'update' || operation === 'clean') {
                // Remove the symbolic link
                // It is OK if the file does not exist
                fs.unlink(source, suppressErrors(['ENOENT'], callback));
            }
            else {
                callback(null);
            }
        },
        function(callback) {
            if (operation === 'create' || operation === 'update') {
                // (Re)create the symbolic link
                fs.symlink(target, source, function(err) {
                    callback(err);
                });
            }
            else {
                callback(null);
            }
        }
    ], function(err, results) {
        callback(err);
    });
};

// Create/update/remove symbolic links to all files in
// the directory (non-recursively) matching the pattern
var updateLinks = function(directory, patternRegExp, callback) {
    async.parallel({
        mkdir: function(callback) {
            // Create the directory in the project
            // It is OK if the directory already exists
            fs.mkdir(path.join(projectResourcesDir, directory), suppressErrors(['EEXIST'], callback));
        },
        files: function(callback) {
            // List the files in the directory
            fs.readdir(path.join(appDevDir, directory), function(err, files) {
                callback(err, files);
            });
        }
    }, function(err, results) {
        // Determine which files match the pattern
        // The pattern can be set to true to automatically match all files
        var files = (patternRegExp === true ? results.files : results.files.filter(function(file) {
            return patternRegExp.test(file);
        })).map(function(file) {
            return path.join(directory, file);
        });
        async.forEach(files, updateLink, callback);
    });
};

// Update all of the project's symbolic links
var updateProjectLinks = function(callback) {
    async.parallel([
        function(callback) {
            // Create symbolic links to these directories
            async.forEach(['appdev'], updateLink, callback);
        },
        function(callback) {
            // Create symbolic links to the files in these directories
            async.forEach([
                { dir: '.', pattern: /^.+\.js$/ },
                { dir: 'models', pattern: /^.+\.js$/ },
                { dir: 'ui', pattern: /^.+\.js$/ }
            ], function(dirData, callback) {
                updateLinks(dirData.dir, dirData.pattern || true, callback);
            }, callback);
        }
    ], callback);
};

async.series([
    function(callback) {
        if (operation === 'create') {
            createProject(callback);
        }
        else {
            callback(null);
        }
    },
    updateProjectLinks
], function(err) {
    if (err) throw err;
    console.log('Finished!');
});
