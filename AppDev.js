/*
 * This AppDev module contains all the code contained in the AppDev framework.
 */

// Create the AppDev object and add it to the global namspace, aliased by AD and AppDev
var global = require('global');
var AD = module.exports = global.AD = global.AppDev = {};

// Initialize jQuery
var $ = require('jquery/load'); 

// Load application defaults
AD.Defaults = $.extend(true, require('defaultsBase'), require('defaults'));

AD.init = function(options) {
    var appDevInitCompleteDfd = $.Deferred();
    
    // Attempt an initialization
    var tryInit = function() {
        // If the initialization succeeds, resolve the appDevInitCompleteDfd deferred that was returned from this function.
        // It if fails, retry the initialization
        var initDfd = $.Deferred();
        initialize(options).then(initDfd.resolve, initDfd.reject);
        initDfd.done(appDevInitCompleteDfd.resolve).fail(failCallback);
    };
    
    var $winError = null;
    
    // Called when an initialization attempt fails
    var failCallback = function(error) {
        // The AppDev initialization failed
        Ti.API.error('Initialization failed!');
        Ti.API.log(JSON.stringify(error));
        
        if (!$winError) {
            // Create the error window the first time it is needed
            require('ui/ErrorWindow');
            $winError = new AD.UI.ErrorWindow({
                error: error,
                retry: function() {
                    // Retry initialization
                    Ti.API.log('Retrying initialization...');
                    tryInit();
                }
            });
            $winError.open();
        }
        else {
            // Update the error message of the existing error window
            $winError.setError(error);
        }
    };
    
    // After initialization, close the error window if it has been created
    appDevInitCompleteDfd.done(function() {
        if ($winError && $winError.isOpen) {
            $winError.close();
        }
    })
    
    // Boot and install the application, then initialize it
    boot(options);
    install(options).done(tryInit);
    
    // Prevent this function from being called again
    delete AD.init;
    
    return appDevInitCompleteDfd.promise();
};

// Initialize all AppDev resources
var boot = function(options) {
    // Return the primary key of this model instance
    $.Model.prototype.getId = function() {
        return this.attr(this.constructor.id);
    };
    
    AD.Platform = require('./Platform');
    
    AD.EncryptionKey = {
        get: function() {
            return AD.Platform.isiOS ? require('com.0x82.key.chain').getPasswordForService('database_key', 'main') : null;
        },
        set: function(key) {
            if (AD.Platform.isiOS) {
                require('com.0x82.key.chain').setPasswordForService(key, 'database_key', 'main');
            }
        }
    };
    
    // Mirror the NodeJS AD.jQuery
    AD.jQuery = AD.$ = $;
    
    AD.SmartBinder = require('SmartBinder');
    
    AD.PropertyStore = require('PropertyStore');
    
    AD.Comm = {};
    AD.Comm.HTML = require('comm/HTML');
    
    AD.Models = {};
    
    AD.Lang = {
        listLanguages: [{en: 'English'}]
    };
    
    AD.ServiceJSON = require('comm/serviceJSON');
    
    // Load the UI module
    AD.UI = $.extend(true, require('UIBase'), require('UI'));
    Ti.API.log('Loaded UI modules');
};

var install = function(options) {
    // Install the application if necessary
    return require('install').install(options);
};

var initialize = function(options) {
    // Load model dependencies
    Ti.API.log('Loading model dependencies...');
    require('db/model_SQL');
    require('db/model_SQLMultilingual');
    require('db/ServerModel');
    Ti.API.log('Loaded model dependencies');
    AD.ServiceModel = require('db/serviceModel');
    // Now load each of the AppDev models
    Ti.API.log('Loading models...');
    options.models.forEach(function(model) {
        Ti.API.log('Loading '+model+' model');
        var Model = require('models/'+model);
        // Wrap the new class so that the id property CommonJS appends an 'id' attribute
        // to all objects returned by require, overwriting the Model.id attribute.  Restore
        // it to its original value, the primary key of the value
        Model.id = Model.primaryKey;
    });
    Ti.API.log('Finshed loading models');
    
    // When all deferreds in this array have been resolved, then initialization has completed and initDfd will be resolved
    var initDfds = [];
    var initDfd = $.Deferred();
    
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
        var LoginWindow = require('ui/LoginWindow');
        AD.winLogin = new LoginWindow();
        Ti.API.log('Created LoginWindow');
        
        // Get the user's viewer data from the server, possibly causing an authentication request
        Ti.API.log('Requesting viewer information...');
        var getViewerDfd = $.Deferred();
        addInitDfd(getViewerDfd);
        AD.ServiceJSON.post({
            url: '/api/site/viewer/whoAmI',
            success: function(data) {
                Ti.API.log('Viewer information received');
                var viewer = AD.Models.Viewer.model(data.data);
                addInitDfd(AD.setViewer(viewer));
                getViewerDfd.resolve();
            },
            failure: function(error) {
                getViewerDfd.reject({
                    description: 'Could not resolve viewer',
                    technical: error,
                    fix: AD.Defaults.development ?
                        'Please verify the AppDev Node.js server is running and that the "Server URL" application preference is set to the correct address.' :
                        'Please verify that you are connected to the VPN.'
                });
            }
        });
    }
    else {
        addInitDfd(AD.setViewer({viewer_id: 1})); // dummy viewer
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

// Initialize the AppDev model custom extend function
AD.Model = {};
AD.Model.extend = function(name, definition, instanceMethods) {
    var Model = null;
    
    // Could force the model name to be of the format AD.Models.<ModelName> here
    
    // Lookup the connection type name in the ConnectionTypes array and assign it the default value if it could not be found 
    var connectionTypes = AD.Defaults.Model.ConnectionTypes;
    var connection = connectionTypes[definition.connectionType || AD.Defaults.Model.defaultConnectionType];
    if (connection === connectionTypes.local) {
        var properties = definition;
        var staticProperties = $.extend({
            __adModule: definition._adModule,
            __adModel: definition._adModel,
            __hub: null  // placeholder for a module's notification hub
        }, properties);
        
        // if provided definition is not Multilingual
        var baseModel = null;
        if (properties.type === 'single') {
            baseModel = AD.Model.ModelSQL;
        } else if (properties.type === 'multilingual') {
            baseModel = AD.Model.ModelSQLMultilingual;
        } else {
            // don't know; use the standard model
            baseModel = AD.Model.ModelSQL;
        }
        
        // Derive from the LocalModel model
        Model = baseModel.extend(name, staticProperties, instanceMethods);
    }
    else if (connection === connectionTypes.server) {
        // Derive from the ServerModel model
        Model = AD.ServerModel.extend(name, definition, instanceMethods);
    }
    else {
        Ti.API.error('Invalid connection type ['+connection+']!');
    }
    
    // Create the cache only if the model's static 'cache' property equals true
    if (definition.cache === true) {
        // Create the cache class and save it to Model.Cache
        var Cache = $.Model.Cache(Model.fullName+'.Cache', {
            Model: Model
        }, {});
        
        // Create the cache, but do not actually build the cache until refreshCaches is called
        // This overwrites the cache=true property
        Model.cache = new Cache({createCache: false}); 
    }
    
    // Store the model in AD.Models
    var nameParts = name.split('.');
    var modelName = nameParts[nameParts.length - 1];
    AD.Models[modelName] = Model;
    
    return Model;
};


AD.Viewer = null;

// Set the AppDev viewer model instance
AD.setViewer = function(viewer) {
    AD.Viewer = viewer;
    
    // Reload the caches
    return refreshCaches();
};

// Refresh each of the model caches
function refreshCaches() {
    var dfd = $.Deferred();
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
                'Please verify that the necessary AppDev module is enabled through the component manager interface.' :
                'Please verify that you are connected to the VPN.'
        });
    });
    return dfd.promise();
}
