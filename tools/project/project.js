// Load required modules
var path = require('path');
var fs = require('fs-extra');
var async = require('async');

// Return a function to suppress errors of the types found in the errors array
// args is an optional array of the parameters that will be
// passed to the callback in the event of a suppressed error
var suppressErrors = function(errors, callback, args) {
    var params = [null].concat(args); // prepend null err argument
    return function(err) {
        callback.apply(this, (err && errors.indexOf(err.code) === -1) ? arguments : params);
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
var createProject = function(params, callback) {
    async.series([
        function(callback) {
            // Create the project root directory, ignoring errors if it already exists
            fs.mkdir(params.projectDir, suppressErrors(['EEXIST'], callback));
        },
        function(callback) {
            // Copy the template files to the project
            fs.copy(path.join(params.appDevDir, 'templates'), params.projectDir, callback);
        }
    ], callback);
};

// Create/update/remove a reference to an AppDev resource
var updateReference = function(params, destination, callback) {
    // Calculate the source, where the resource is located
    var source = path.join(params.projectResourcesDir, destination);
    var sourceRelative = path.relative(params.titaniumDir, source);
    
    params.resources.push(path.relative(params.projectDir, source));
    
    async.series([
        function(callback) {
            if (params.operation === 'clean') {
                console.log('[remove] %s', sourceRelative);
            }
            // Remove the resource, ignoring errors if it does not exist
            fs.remove(source, suppressErrors(['ENOENT'], callback));
        },
        function(callback) {
            if (params.operation === 'create' || params.operation === 'update') {
                // Calculate the target, where the original resource is located
                var target = path.join(params.appDevDir, destination);
                var targetRelative = path.relative(params.titaniumDir, target);
                
                // (Re)create the resource
                console.log('[%s] %s -> %s', params.copy ? 'copy' : 'link', sourceRelative, targetRelative);
                (params.copy ? fs.copy : fs.symlink)(target, source, callback);
            }
            else {
                callback(null);
            }
        }
    ], callback);
};

// Create/update/remove resource references in the directory (non-recursively) matching the pattern
var updateReferences = function(params, directory, patternRegExp, callback) {
    async.parallel({
        mkdir: function(callback) {
            // Create the directory in the project, ignoring errors if it already exists
            fs.mkdir(path.join(params.projectResourcesDir, directory), suppressErrors(['EEXIST'], callback));
        },
        files: function(callback) {
            // List the files in the directory
            fs.readdir(path.join(params.appDevDir, directory), callback);
        }
    }, function(err, results) {
        // Determine which files match the pattern
        // The pattern can be set to true to automatically match all files
        var files = (patternRegExp === true ? results.files : results.files.filter(patternRegExp.test, patternRegExp)).map(function(file) {
            return path.join(directory, file);
        });
        async.forEach(files, async.apply(updateReference, params), callback);
    });
};

// Remove all dead symbolic links from the project
var walker = require('walker');
var pruneDeadLinks = function(params, callback) {
    var callback = callOnce(callback);
    walker(params.projectResourcesDir).on('symlink', function(file, stat) {
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
                        console.log('[prune] %s', path.relative(params.titaniumDir, file));
                        fs.remove(file, callback);
                    }
                });
            }
        ], function(err) {
            if (err) {
                callback(err);
            }
        });
    }).on('error', callback).on('end', callback);
};

// Update all of the project's resource references
var updateProjectReferences = function(params, callback) {
    async.parallel([
        function(callback) {
            // Create references to these directories
            async.forEach(['appdev'], async.apply(updateReference, params), callback);
        },
        function(callback) {
            // Create references to the files in these directories
            async.forEach([
                { dir: '.', pattern: /\.js$/ },
                { dir: 'images', pattern: /\.png$/ },
                { dir: 'models', pattern: /\.js$/ },
                { dir: 'ui', pattern: /\.js$/ }
            ], function(dirData, callback) {
                updateReferences(params, dirData.dir, dirData.pattern || true, callback);
            }, callback);
        }
    ], callback);
};

// Update the project's .gitignore file to ignore all AppDev resources
var updateGitIgnore = function(params, callback) {
    var gitIgnorePath = path.join(params.projectDir, '.gitignore');
    async.waterfall([
        function(callback) {
            // File content defaults to an empty string in the case of a ENOENT error
            fs.readFile(gitIgnorePath, 'utf8', suppressErrors(['ENOENT'], callback, ['']));
        },
        function(gitIgnoreContent, callback) {
            var startTag = '# AppDev resources start';
            var endTag = '# AppDev resources end';
            
            // Replace the existing resources block or append it to the end of the file
            var regExpParts = ['(', startTag, '[\\s|\\S]*', endTag, ')', '|$'];
            var regExp = new RegExp(regExpParts.join(''));
            
            var ignoreLines = [].concat(startTag, params.resources, endTag);
            var updatedGitIgnoreContent = gitIgnoreContent.replace(regExp, ignoreLines.join(require('os').EOL));
            callback(null, updatedGitIgnoreContent);
        },
        function(gitIgnoreContent, callback) {
            fs.writeFile(gitIgnorePath, gitIgnoreContent, callback);
        }
    ], callback);
};

var updateOperations = [
    updateProjectReferences,
    pruneDeadLinks,
    updateGitIgnore
];
var makeOperationStack = function(params, extras) {
    // Prepend extra operations if provided
    return (extras ? extras.slice(0) : []).concat(updateOperations).map(function(operation) {
        return function() {
            // Prepend the params argument when calling the function
            var args = Array.prototype.slice.call(arguments, 0);
            args.unshift(params);
            operation.apply(this, args);
        };
    });
};

var setup = function(params, operation) {
    // Calculate the paths of the AppDev, and Titanium, and project directories
    params.appDevDir = path.resolve(__dirname, '..', '..');
    params.titaniumDir = path.resolve(params.appDevDir, '..');
    params.projectDir = path.resolve(params.titaniumDir, params.project);
    params.projectResourcesDir = path.resolve(params.projectDir, 'Resources');
    params.resources = []; // an array that will contain all AppDev resources
    params.operation = operation;
    console.log('Titanium directory: '+params.titaniumDir);
    console.log('AppDev directory: '+params.appDevDir);
    console.log('Project directory: '+params.projectDir);
    console.log('\n');
};
var addOperation = function(name, operation) {
    module.exports[name] = function(params) {
        setup(params, name);
        return operation.apply(this, arguments);
    };
};

addOperation('create', function(params, callback) {
    async.series(makeOperationStack(params, [createProject]), callback);
});
addOperation('update', function(params, callback) {
    async.series(makeOperationStack(params), callback);
});
addOperation('clean', function(params, callback) {
    async.series(makeOperationStack(params), callback);
});
