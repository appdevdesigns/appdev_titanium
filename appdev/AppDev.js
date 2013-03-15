/*
 * This AppDev module contains all the code contained in the AppDev framework.
 */

// Create the AppDev object and add it to the global namespace, aliased by AD and AppDev
var global = require('appdev/global');
var AD = module.exports = global.AD = global.AppDev = {};

// Initialize jQuery
var $ = require('appdev/jquery/load');

// Load application defaults
AD.Defaults = $.extend(true, require('appdev/defaultsBase'), require('defaults'));

AD.init = function(options) {
    var appDevInitCompleteDfd = $.Deferred();
    
    // Attempt an initialization
    var tryInit = function() {
        // If the initialization succeeds, resolve the appDevInitCompleteDfd deferred that was returned from this function.
        // It if fails, retry the initialization
        var initDfd = $.Deferred();
        initialize(options).then(initDfd.resolve, initDfd.reject);
        initDfd.done(appDevInitCompleteDfd.resolve);
        AD.handleError(initDfd, tryInit);
    };
    
    // Boot and install the application, then initialize it
    boot(options);
    login(options).done(function() {
        install(options).done(tryInit);
    });
    
    // Prevent this function from being called again
    delete AD.init;
    
    return appDevInitCompleteDfd.promise();
};

// Attach a failure handler to this deferred that will display an error window with an optional retry callback
AD.handleError = function(dfd, retry) {
    dfd.fail(function(error) {
        AD.UI.displayError({
            error: error,
            retry: retry
        });
    });
};

// Initialize all AppDev resources
var boot = function(options) {
    // Return the primary key of this model instance
    $.Model.prototype.getId = function() {
        return this.attr(this.constructor.id);
    };
    
    AD.Deferreds = {
        login: $.Deferred(), // dictionary of registered important initialization deferreds
        buildCaches: $.Deferred()
    };
    
    // Like L(...), except that the key, rather than null, is returned on Android
    AD.L = AD.Localize = function(key, defaultValue) {
        return L(key) || defaultValue || key;
    };
    
    AD.CryptoJS = require('appdev/cryptojs');
    AD.sjcl = require('appdev/sjcl');
    
    AD.Platform = require('appdev/Platform');
    
    AD.EncryptionKey = require('appdev/encryptionKey');
    
    // Mirror the NodeJS AD.jQuery
    AD.jQuery = AD.$ = $;
    
    AD.SmartBinder = require('appdev/SmartBinder');
    
    AD.FileStore = require('appdev/FileStore');
    AD.PropertyStore = require('appdev/PropertyStore');
    
    AD.Comm = {};
    AD.Comm.HTML = require('appdev/comm/HTML');
    
    AD.Models = {};
    
    AD.Lang = {
        listLanguages: [{en: 'English'}]
    };
    
    AD.ServiceJSON = require('appdev/comm/serviceJSON');
    
    // Load the UI module
    AD.UI = $.extend(true, require('appdev/UIBase'), require('UI'));
    require('ui/ErrorWindow');
    Ti.API.log('Loaded UI modules');
};

var install = function(options) {
    // Install the application if necessary
    return require('appdev/install').install(options);
};

var login = function(options) {
    var loginDfd = AD.Deferreds.login;
    var password = Ti.App.Properties.getString('password');
    AD.EncryptionKey.passwordHash = Ti.App.Properties.getString('passwordHash');
    if (!AD.EncryptionKey.passwordHash) {
        // The password hash has not been set yet, so login is impossible
        // Either the application has not yet been installed or this is a pre-1.0.3 version that has yet to be upgraded
        loginDfd.resolve(true);
    }
    else if (!AD.Defaults.localStorageEnabled) {
        // Local storage is disabled, so there is no reason to force the user to login
        loginDfd.resolve(true);
    }
    else if (AD.EncryptionKey.password) {
        // User is already logged in
        loginDfd.resolve(true);
    }
    else if (password) {
        // Login using the stored password
        AD.EncryptionKey.login(password);
        loginDfd.resolve(true);
    }
    else if (AD.Platform.isiOS) {
        // On iOS, login using the password from the keychain
        password = require('com.0x82.key.chain').getPasswordForService(Ti.App.id, 'database_encryption_key');
        AD.EncryptionKey.login(password);
        loginDfd.resolve(true);
    }
    else {
        // Ask the user for their login password
        var PasswordPromptWindow = require('ui/PasswordPromptWindow');
        $winPasswordPrompt = new PasswordPromptWindow({
            title: 'passwordPromptLoginTitle',
            message: 'passwordPromptLoginMessage',
            verifyCallback: function(guess) {
                return AD.EncryptionKey.hash(guess) === AD.EncryptionKey.passwordHash;
            }
        });
        $winPasswordPrompt.getDeferred().done(function(password) {
            AD.EncryptionKey.login(password);
            loginDfd.resolve(true);
        });
    }
    loginDfd.done(function(success) {
        Ti.API.log('Logged in successfully!');
    });
    return loginDfd.promise();
};

var initialize = function(options) {
    // When all deferreds in this array have been resolved, then initialization has completed and initDfd will be resolved
    var initDfds = [];
    var initDfd = $.Deferred();
    
    // Initialize the property store
    AD.PropertyStore.read();
    
    // Load model dependencies
    Ti.API.log('Loading model dependencies...');
    AD.Model = require('appdev/db/ADModel');
    require('appdev/db/model_SQL');
    require('appdev/db/model_SQLMultilingual');
    require('appdev/db/ServerModel');
    require('appdev/db/SyncedModel');
    Ti.API.log('Loaded model dependencies');
    AD.ServiceModel = require('appdev/db/serviceModel');
    // Now load each of the AppDev models
    Ti.API.log('Loading models...');
    options.models.forEach(function(model) {
        Ti.API.log('Loading '+model+' model');
        var Model = require('models/'+model);
        // Wrap the new class so that the id property CommonJS appends an 'id' attribute
        // to all objects returned by require, overwriting the Model.id attribute.  Restore
        // it to its original value, the primary key of the model
        Model.id = Model.primaryKey;
    });
    Ti.API.log('Finshed loading models');
    
    // Add a new task, represented by a deferred, that must be completed during initialization
    var addInitDfd = function(newInitDfd) {
        newInitDfd.fail(initDfd.reject);
        initDfds.push(newInitDfd);
    };
    
    // Resolve initDfd when all deferreds in initDfds have been resolved/rejected
    var initDfdsEmpty = false;
    var checkInitDone = function() {
        if (initDfdsEmpty && initDfds.length === 0) {
            // The deferred array was empty during last iteration and is still empty, so initialization is done
            clearInterval(checkInitInterval);
            initDfd.resolve();
            return;
        }
        
        // Remove all resolved/rejected deferreds
        initDfds = initDfds.filter(function(dfd) {
            return dfd.state() === 'pending';
        });
        initDfdsEmpty = initDfds.length === 0;
    };
    // Call checkInitDone five times every second
    var checkInitInterval = setInterval(checkInitDone, 200);
    
    if (AD.Defaults.serverStorageEnabled) {
        // Create the login window
        require('ui/LoginWindow');
        AD.winLogin = new AD.UI.LoginWindow();
        Ti.API.log('Created LoginWindow');
        
        // Attempt to read the viewer out of the PropertyStore
        var viewer = AD.PropertyStore.get('viewer');
        if (viewer) {
            // Found viewer information, so WhoAmI request is unnecessary
            AD.setViewer(viewer);
        }
        else {
            // Get the user's viewer data from the server, possibly causing an authentication request
            Ti.API.log('Requesting viewer information...');
            var getViewerDfd = $.Deferred();
            addInitDfd(getViewerDfd);
            AD.ServiceJSON.post({
                url: '/api/site/viewer/whoAmI',
                success: function(response) {
                    Ti.API.log('Viewer information received');
                    viewer = response.data;
                    AD.PropertyStore.set('viewer', viewer);
                    addInitDfd(AD.setViewer(viewer));
                    getViewerDfd.resolve();
                },
                failure: function(error) {
                    getViewerDfd.reject({
                        description: 'Could not resolve viewer',
                        technical: error,
                        fix: AD.Defaults.development ?
                            'Please verify the that "Server URL" application preference is set to the correct address and that the AppDev Node.js server is running.' :
                            'Please verify the that "Server URL" application preference is set to the correct address and that the server is accessible.'
                    });
                }
            });
        }
    }
    else {
        addInitDfd(AD.setViewer({viewer_id: 1})); // dummy viewer_id
    }
    
    Ti.API.log('Finished AppDev initialization');
    
    if (options.windows) {
        initDfd.done(function() {
            // Initialize the top-level UI
            require('ui/AppTabGroup');
            var $appTabGroup = new AD.UI.AppTabGroup({
                windows: options.windows
            });
            $appTabGroup.open();
        });
    }
    
    return initDfd.promise();
};

AD.Viewer = null;

// Set the AppDev viewer model instance
AD.setViewer = function(viewerData) {
    AD.Viewer = AD.Models.Viewer.model(viewerData);
    
    // Reload the caches
    return refreshCaches();
};

// Refresh each of the model caches
var refreshCaches = function() {
    var dfd = AD.Deferreds.buildCaches;
    var refreshDfds = [];
    $.each(AD.Models, function(name, Model) {
        // If cache=true in the model definition, Model.cache will be overwritten
        // with the cache object, but it will remain a 'truthy' value
        var cache = Model.cache;
        if (!cache) {
            return;
        }
        
        Ti.API.log('Building '+name+' cache...');
        // Only load models associated with this viewer
        var filter = {viewer_id: AD.Viewer.viewer_id};
        // Expand the cache filter to include the filter specified in the model definition
        var cacheFilter = Model.cacheFilter;
        if ($.isFunction(cacheFilter)) {
            cacheFilter = Model.cacheFilter();
        }
        var cacheDfd = $.Deferred();
        $.when(cacheFilter).done(function(trueCacheFilter) {
            // If cacheFilter is a deferred, this will be executed after it is resolved
            // If it is a plain object, this will be executed immediately
            $.extend(filter, trueCacheFilter);
            
            // Set the cache filter and build the cache
            cache.setFilter(filter);
            cache.refresh().then(cacheDfd.resolve, cacheDfd.reject);
        }).fail(cacheDfd.reject);
        
        refreshDfds.push(cacheDfd.done(function() {
            Ti.API.log('Built '+name+' cache');
        }));
    });
    // When all deferreds in refreshDfds have resolved, then resolve the returned deferred
    $.when.apply($, refreshDfds).done(function() {
        Ti.API.log('All model caches built');
        dfd.resolve();
    }).fail(function(error) {
        Ti.API.error('Model cache building failed');
        dfd.reject({
            description: 'Could not load application data',
            technical: error,
            fix: AD.Defaults.development ?
                'Please verify that the NextSteps AppDev module is enabled through the component manager interface.' :
                'Please verify that the server is accessible.'
        });
    });
    return dfd.promise();
};
