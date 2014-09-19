// Load dependencies
var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var _ = require('underscore');
var Callback = require('callback.js');

var walker = null;
module.exports.load = function() {
    walker = require('walker');
};

var operations = module.exports.operations = {};

// Create the project
operations.create = function(params, callback) {
    console.log('create'.green, 'project', params.project.info, 'at', params.projectDir.info);
    async.series([
        function(callback) {
            // Create the project root directory, ignoring errors if it already exists
            fs.mkdir(params.projectDir, Callback.suppressErrors(['EEXIST'], callback));
        },
        function(callback) {
            // Copy the template files to the project
            fs.copy(path.join(params.appDevDir, 'templates'), params.projectDir, callback);
        }
    ], callback);
};

// Create or update a reference to an AppDev resource
var updateReference = function(params, resource, callback) {
    // Calculate the source, where the resource is located
    var source = resource.projectPath;
    var sourceRelative = path.relative(params.titaniumDir, source);
    
    async.series([
        function(callback) {
            // Remove the resource, ignoring errors if it does not exist
            fs.remove(source, Callback.suppressErrors(['ENOENT'], callback));
        },
        function(callback) {
            // Create the directory containing the resource, ignoring errors if it already exists
            fs.mkdirs(path.dirname(source), Callback.suppressErrors(['EEXIST'], callback));
        },
        function(callback) {
            // Calculate the target, where the original resource is located
            var target = resource.appDevPath;
            var targetRelative = path.relative(params.titaniumDir, target);
            
            // (Re)create the resource
            console.log((params.copy ? 'copy' : 'link').green, sourceRelative.info, '->', targetRelative.yellow);
            (params.copy ? fs.copy : fs.symlink)(target, source, callback);
        }
    ], callback);
};

// Remove a reference to an AppDev resource
var removeReference = function(params, resource, callback) {
    // Calculate the source, where the resource is located
    var source = resource.projectPath;
    var sourceRelative = path.relative(params.titaniumDir, source);
    
    console.log('remove'.red, sourceRelative.info);
    // Remove the resource, ignoring errors if it does not exist
    fs.remove(source, Callback.suppressErrors(['ENOENT'], callback));
};

// Update all of the project's resource references
operations.update = function(params, callback) {
    async.each(params.resources, async.apply(updateReference, params), callback);
};
// Update all of the project's resource references
operations.clean = function(params, callback) {
    async.each(params.resources, async.apply(removeReference, params), callback);
};
[operations.update, operations.clean].forEach(function(resourceOperation) {
    _.extend(resourceOperation, {
        flag: '!resources',
        opts: ['copy']
    });
});

// Remove all dead symbolic links from the project
operations.prune = function(params, callback) {
    var callback = _.once(callback);
    walker(params.projectDir).on('symlink', function(file, stat) {
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
                        console.log('prune'.red, path.relative(params.titaniumDir, file).info);
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
operations.prune.flag = '!prune';

// Modify the .gitignore file
var updateGitIgnore = function(params, operationName, getIgnorePatterns, callback) {
    var gitIgnorePath = path.join(params.projectDir, '.gitignore');
    console.log(operationName, path.relative(params.titaniumDir, gitIgnorePath).info);
    async.waterfall([
        function(callback) {
            // File content defaults to an empty string in the case of a ENOENT error
            fs.readFile(gitIgnorePath, 'utf8', Callback.suppressErrors(['ENOENT'], callback, ['']));
        },
        function(gitIgnoreContent, callback) {
            var startTag = '# AppDev resources start';
            var endTag = '# AppDev resources end';
            
            // Replace the existing resources block or append it to the end of the file
            var regExpParts = ['(', startTag, '[\\s|\\S]*', endTag, ')', '|$'];
            var regExp = new RegExp(regExpParts.join(''));
            
            var EOL = require('os').EOL;
            var ignoreLines = getIgnorePatterns();
            // If ignoreLines is null or an empty array, the new ignore
            // content block should be empty. Otherwise, the block will
            // contain the lines to ignore, delimited by the start and end tags.
            var ignoreContent = (ignoreLines && ignoreLines.length) ? [].concat(startTag, ignoreLines, endTag).join(EOL) : '';
            
            // Ensure exactly one newline at the end of the file
            var updatedGitIgnoreContent = gitIgnoreContent.replace(regExp, ignoreContent).trim().concat(EOL);
            callback(null, updatedGitIgnoreContent);
        },
        function(gitIgnoreContent, callback) {
            fs.writeFile(gitIgnorePath, gitIgnoreContent, callback);
        }
    ], callback);
};

// Update the project's .gitignore file to ignore all AppDev resources
operations.augmentGitIgnore = function(params, callback) {
    updateGitIgnore(params, 'augment'.green, function() {
        // Calculate the resource paths relative to the project directory
        return params.resources.map(function(resource) {
            return path.relative(params.projectDir, resource.projectPath);
        });
    }, callback);
};
operations.augmentGitIgnore.flag = '!gitignore';

// Update the project's .gitignore file to stop ignoring all AppDev resources
operations.cleanGitIgnore = function(params, callback) {
    updateGitIgnore(params, 'clean'.red, function() {
        return null;
    }, callback);
};
operations.cleanGitIgnore.flag = '!gitignore';

var setup = function(params, callback) {
    // Calculate the paths of the AppDev, and Titanium, and project directories
    params.appDevDir = path.resolve(__dirname, '..', '..', '..', '..');
    params.appDevFrameworkDir = path.resolve(params.appDevDir, 'framework');
    params.titaniumDir = path.resolve(params.appDevDir, '..');
    params.projectDir = path.resolve(params.titaniumDir, params.project);
    console.log('Titanium directory:'.label, params.titaniumDir);
    console.log('AppDev directory:'.label, params.appDevDir);
    console.log('Project directory:'.label, params.projectDir);
    console.log('\n');
    callback(null);
};

// Fill the params "resources" array property with an entry for each AppDev resource file
operations.enumResources = function(params, callback) {
    // These are resource directories
    var resourceDirs = [path.join('plugins', 'appdev-framework'), path.join('Resources', 'appdev')];
    // These patterns match resource files in the specified directory
    var resourcePatterns = [
        { dir: 'i18n', pattern: /strings\.xml$/, recursive: true },
        { dir: 'Resources', pattern: /\.js$/ },
        { dir: path.join('Resources', 'android'), recursive: true },
        { dir: path.join('Resources', 'images'), pattern: /\.png$/ },
        { dir: path.join('Resources', 'models'), pattern: /\.js$/ },
        { dir: path.join('Resources', 'ui'), pattern: /\.js$/ }
    ];
    
    var enumDirectory = function(directory, recursive, callback) {
        var files = [];
        walker(directory).filterDir(function(dir, stat) {
            return dir === directory || recursive;
        }).on('file', function(file, stat) {
            files.push(file);
        }).on('error', callback).on('end', function() {
            callback(null, files);
        });
    };
    
    // Find the resources matching the resource patterns
    async.map(resourcePatterns, function(resourcePattern, callback) {
        var directory = resourcePattern.dir;
        var patternRegExp = resourcePattern.pattern;
        enumDirectory(path.resolve(params.appDevFrameworkDir, directory), resourcePattern.recursive, function(err, files) {
            // Determine which files match the pattern
            // The pattern can be set to true to automatically match all files
            var filteredResources = patternRegExp ? files.filter(patternRegExp.test, patternRegExp) : files;
            // Strip off the appDevDir portion of the filenames, making them relative
            var resources = filteredResources.map(function(file) {
                return path.relative(params.appDevFrameworkDir, file);
            });
            callback(err, resources);
        });
    }, function(err, resources) {
        // "resources" is an array of arrays, so flatten it to a one-dimensional array
        var flattenedResources = resources.reduce(function(a, b) {
            return a.concat(b);
        }, []);
        
        // Start with an empty resources array...
        params.resources = []
        // Then add the resource directories...
        .concat(resourceDirs)
        // Then add the discovered resource files...
        .concat(flattenedResources)
        // Finally, calculate a few other related paths for each resource
        .map(function(resource) {
            return {
                // The relative resource path
                resource: resource,
                // The absolute path resource in the AppDev root directory
                appDevPath: path.join(params.appDevFrameworkDir, resource),
                // The absolute path resource in the project's root directory
                projectPath: path.join(params.projectDir, resource)
            };
        });
        callback(err);
    });
};

module.exports.setupStack = [setup];
