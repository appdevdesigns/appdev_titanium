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

// Defaults to false, symbolically link resources
var copyFiles = (args[2] === '-c' || args[2] === '--copy');

// Print the currently executing command
console.log(verb, project);

// Load required modules
var path = require('path');
var fs = require('fs-extra');
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

// An array that will contain all AppDev resources
var resources = [];

// Return a function to suppress errors of the types found in the errors array
var suppressErrors = function(errors, callback) {
    return function(err) {
        callback((err && errors.indexOf(err.code) === -1) ? err : null);
    };
};

// Ensure that callback is called only once
var callOnce = function(callback) {
    var called = false;
    return function() {
        if (!called) {
            called = true;
            callback.apply(this, arguments);
        }
    };
};

// Create the project
var createProject = function(callback) {
    async.series([
        function(callback) {
            // Create the project root directory, ignoring errors if it already exists
            fs.mkdir(projectDir, suppressErrors(['EEXIST'], callback));
        },
        function(callback) {
            // Copy the template files to the project
            fs.copy(path.join(appDevDir, 'templates'), projectDir, callback);
        }
    ], callback);
};

// Create/update/remove a reference to an AppDev resource
var updateReference = function(destination, callback) {
    // Calculate the source, where the resource is located
    var source = path.join(projectResourcesDir, destination);
    var sourceRelative = path.relative(titaniumDir, source);
    
    resources.push(path.relative(projectDir, source));
    
    async.series([
        function(callback) {
            if (operation === 'clean') {
                console.log('[remove] %s', sourceRelative);
            }
            if (operation === 'update' || operation === 'clean') {
                // Remove the resource, ignoring errors if it does not exist
                fs.remove(source, suppressErrors(['ENOENT'], callback));
            }
            else {
                callback(null);
            }
        },
        function(callback) {
            if (operation === 'create' || operation === 'update') {
                // Calculate the target, where the original resource is located
                var target = path.join(appDevDir, destination);
                var targetRelative = path.relative(titaniumDir, target);
                
                // (Re)create the resource
                console.log('[%s] %s -> %s', copyFiles ? 'copy' : 'link', sourceRelative, targetRelative);
                (copyFiles ? fs.copy : fs.symlink)(target, source, callback);
            }
            else {
                callback(null);
            }
        }
    ], function(err, results) {
        callback(err);
    });
};

// Create/update/remove resource references in the directory (non-recursively) matching the pattern
var updateReferences = function(directory, patternRegExp, callback) {
    async.parallel({
        mkdir: function(callback) {
            // Create the directory in the project, ignoring errors if it already exists
            fs.mkdir(path.join(projectResourcesDir, directory), suppressErrors(['EEXIST'], callback));
        },
        files: function(callback) {
            // List the files in the directory
            fs.readdir(path.join(appDevDir, directory), callback);
        }
    }, function(err, results) {
        // Determine which files match the pattern
        // The pattern can be set to true to automatically match all files
        var files = (patternRegExp === true ? results.files : results.files.filter(patternRegExp.test, patternRegExp)).map(function(file) {
            return path.join(directory, file);
        });
        async.forEach(files, updateReference, callback);
    });
};

// Remove all dead symbolic links from the project
var walker = require('walker');
var pruneDeadLinks = function(callback) {
    var callback = callOnce(callback);
    walker(projectResourcesDir).on('symlink', function(file, stat) {
        async.waterfall([
            function(callback) {
                fs.readlink(file, callback);
            },
            function(link, callback) {
                fs.exists(link, function(exists) {
                    if (exists) {
                        callback(null);
                    }
                    else {
                        // Prune the dead symbolic link
                        console.log('[prune] %s', path.relative(titaniumDir, file));
                        fs.remove(file, callback);
                    }
                });
            }
        ], function(err) {
            if (err) {
                callback(err);
            };
        });
    }).on('error', callback).on('end', callback);
};

// Update all of the project's resource references
var updateProjectReferences = function(callback) {
    async.parallel([
        function(callback) {
            // Create references to these directories
            async.forEach(['appdev'], updateReference, callback);
        },
        function(callback) {
            // Create references to the files in these directories
            async.forEach([
                { dir: '.', pattern: /\.js$/ },
                { dir: 'images', pattern: /\.png$/ },
                { dir: 'models', pattern: /\.js$/ },
                { dir: 'ui', pattern: /\.js$/ }
            ], function(dirData, callback) {
                updateReferences(dirData.dir, dirData.pattern || true, callback);
            }, callback);
        }
    ], callback);
};

// Update the project's .gitignore file to ignore all AppDev resources
var updateGitIgnore = function(callback) {
    var gitIgnorePath = path.join(projectDir, '.gitignore');
    console.log(gitIgnorePath);
    async.waterfall([
        function(callback) {
            fs.readFile(gitIgnorePath, 'utf8', callback);
        },
        function(gitIgnoreContent, callback) {
            var startTag = '# AppDev resources start';
            var endTag = '# AppDev resources end';
            
            // Replace the existing resources block or append it to the end of the file
            var regExpParts = ['(', startTag, '[\\s|\\S]*', endTag, ')', '|$']
            var regExp = new RegExp(regExpParts.join(''));
            
            var ignoreLines = [].concat(startTag, resources, endTag);
            var updatedGitIgnoreContent = gitIgnoreContent.replace(regExp, ignoreLines.join(require('os').EOL));
            callback(null, updatedGitIgnoreContent);
        },
        function(gitIgnoreContent, callback) {
            fs.writeFile(gitIgnorePath, gitIgnoreContent, callback);
        }
    ], callback)
    fs.readFile(path.join(projectDir, '.gitignore'), 'utf8', function(gitIgnoreContent) {
        console.log()
    });
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
    updateProjectReferences,
    pruneDeadLinks,
    updateGitIgnore
], function(err) {
    if (err) throw err;
    console.log('Finished!');
});
