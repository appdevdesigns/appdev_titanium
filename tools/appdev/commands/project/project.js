// Load dependencies
var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var walker = require('walker');
var Callback = require('callback.js');

// Create the project
module.exports.create = function(params, callback) {
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
module.exports.update = function(params, callback) {
    async.each(params.resources, async.apply(updateReference, params), callback);
};

// Update all of the project's resource references
module.exports.clean = function(params, callback) {
    async.each(params.resources, async.apply(removeReference, params), callback);
};

// Remove all dead symbolic links from the project
module.exports.prune = function(params, callback) {
    var callback = Callback.callOnce(callback);
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

// Modify the .gitignore file
var updateGitIgnore = function(params, getIgnorePatterns, callback) {
    var gitIgnorePath = path.join(params.projectDir, '.gitignore');
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
module.exports.augmentGitIgnore = function(params, callback) {
    updateGitIgnore(params, function() {
        // Calculate the resource paths relative to the project directory
        return params.resources.map(function(resource) {
            return path.relative(params.projectDir, resource.projectPath);
        });
    }, callback);
};

// Update the project's .gitignore file to stop ignoring all AppDev resources
module.exports.cleanGitIgnore = function(params, callback) {
    updateGitIgnore(params, function() {
        return null;
    }, callback);
};

var setup = function(params, callback) {
    // Calculate the paths of the AppDev, and Titanium, and project directories
    params.appDevDir = path.resolve(__dirname, '..', '..', '..', '..');
    params.titaniumDir = path.resolve(params.appDevDir, '..');
    params.projectDir = path.resolve(params.titaniumDir, params.project);
    params.projectResourcesDir = path.resolve(params.projectDir, 'Resources');
    console.log('Titanium directory:'.label, params.titaniumDir);
    console.log('AppDev directory:'.label, params.appDevDir);
    console.log('Project directory:'.label, params.projectDir);
    console.log('\n');
    callback(null);
};

// Fill the params "resources" array property with an entry for each AppDev resource file
var enumResources = function(params, callback) {
    // These are all resource directories
    var resources = ['appdev'];
    
    // These patterns match resource files in the specified directory
    async.forEach([
        { dir: '.', pattern: /\.js$/ },
        { dir: 'images', pattern: /\.png$/ },
        { dir: 'models', pattern: /\.js$/ },
        { dir: 'ui', pattern: /\.js$/ }
    ], function(dirData, callback) {
        var directory = dirData.dir;
        var patternRegExp = dirData.pattern;
        fs.readdir(path.join(params.appDevDir, directory), function(err, files) {
            // Determine which files match the pattern
            // The pattern can be set to true to automatically match all files
            (patternRegExp ? files.filter(patternRegExp.test, patternRegExp) : files).forEach(function(file) {
                resources.push(path.join(directory, file));
            });
            callback(err);
        });
    }, function(err) {
        params.resources = resources.map(function(resource) {
            return {
                // The relative resource path
                resource: resource,
                // The absolute path resource in the AppDev directory
                appDevPath: path.join(params.appDevDir, resource),
                // The absolute path resource in the project's resources directory
                projectPath: path.join(params.projectResourcesDir, resource)
            };
        });
        callback(err);
    });
};

module.exports.setupStack = [setup, enumResources];
