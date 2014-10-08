/*
 * This AppDev module contains all the code contained in the AppDev framework.
 */

// Create the AppDev object and add it to the global namespace, aliased by AD and AppDev
var global = require('appdev/global');
var AD = module.exports = global.AD = global.AppDev = {};

// Initialize jQuery
var $ = require('appdev/jquery/load');

// Load application defaults
AD.Defaults = $.extend(true, require('appdev/defaults'), require('app/defaults'));

// Initialize all AppDev resources
var boot = function(options) {
    // Ensure that the boot sequence is run only once
    if (AD.booted) {
        return;
    }
    AD.booted = true;
    
    $.Class.prototype.setup = function(options) {
        if (!this.options) {
            this.options = {};
        }
        // Set this.options to options merged recursively with this.constructor.defaults
        $.extend(true, this.options, this.constructor.defaults, options);
    };
    // Return the primary key of this model instance
    $.Model.prototype.getId = function() {
        return this.attr(this.constructor.id);
    };
    // Return the label of this model instance
    $.Model.prototype.getLabel = function() {
        return this.attr(this.constructor.labelKey);
    };
    // Return an array of ids of the models
    $.Model.getIds = function(models) {
        return models.map(function(model) { return model.getId(); });
    };
    // Return an array of labels of the models
    $.Model.getLabels = function(models) {
        return models.map(function(model) { return model.getLabel(); });
    };
    
    AD.Config = require('app/config');
    
    AD.Deferreds = {
        login: $.Deferred() // dictionary of registered important initialization deferreds
    };
    
    // Like L(...), except that the key, rather than null, is returned on Android
    AD.localize = function(key, defaultValue) {
        return Ti.Locale.getString(key) || defaultValue || key;
    };
    
    // Load the AES and PBKDF2 crypto-js libraries
    AD.CryptoJS = null;
    require('appdev/cryptojs/aes');
    require('appdev/cryptojs/pbkdf2');
    
    AD.sjcl = require('appdev/sjcl');
    AD.Base64 = require('appdev/base64');
    
    AD.Platform = require('appdev/Platform');
    
    AD.EncryptionKey = require('appdev/EncryptionKey');
    AD.Auth = require('appdev/Auth');
    
    if (AD.Platform.isAndroid) {
        // Initialize the Android keepalive service and make sure that it is initially stopped
        AD.keepaliveIntent = Ti.Android.createServiceIntent({
            url: 'Keepalive.js'
        });
        AD.keepaliveIntent.putExtra('interval', 5000); // run service every 5 seconds
        Ti.Android.stopService(AD.keepaliveIntent);
    }
    
    // Mirror the NodeJS AD.jQuery
    AD.jQuery = AD.$ = $;
    
    AD.SmartBinder = require('appdev/SmartBinder');
    
    AD.FileStore = require('appdev/FileStore');
    AD.PropertyStore = require('appdev/PropertyStore');
    
    AD.Location = require('appdev/Location');
    
    AD.Comm = {};
    AD.Comm.HTTP = require('appdev/comm/HTTP');
    require('appdev/comm/CAS');
    AD.Comm.GoogleAPIs = require('appdev/GoogleAPIs');
    AD.Comm.GoogleDrive = require('appdev/comm/GoogleDrive');
    AD.Comm.GoogleDriveFileAPI = require('appdev/comm/GoogleDriveFileAPI');
    
    AD.Viewer = null;
    
    // Load model dependencies
    console.log('Loading model dependencies...');
    AD.Database = require('appdev/db/Database');
    AD.Model = require('appdev/db/ADModel');
    require('appdev/db/model_SQL');
    require('appdev/db/model_SQLMultilingual');
    require('appdev/db/ServerModel');
    require('appdev/db/SyncedModel');
    console.log('Loaded model dependencies');
    AD.ServiceModel = require('appdev/db/serviceModel');
    
    // Now load each of the AppDev models
    console.log('Loading models...');
    AD.Models = {};
    options.models.forEach(function(model) {
        console.log('Loading '+model+' model');
        var Model = require('models/'+model);
        // Wrap the new class so that the id property CommonJS appends an 'id' attribute
        // to all objects returned by require, overwriting the Model.id attribute.  Restore
        // it to its original value, the primary key of the model
        Model.id = Model.primaryKey;
    });
    console.log('Finshed loading models');
    
    // Detect when a model that another model references
    // is destroyed and remove those obsolete references
    $.each(AD.Models, function(name, Model) {
        if (!Model.lookupLabels) {
            return;
        }
        $.each(Model.lookupLabels, function(field, lookupField) {
            var ReferencedModel = AD.Model.lookup(lookupField.tableName);
            ReferencedModel.bind('destroyed', function(event, model) {
                // Find all models that referenced the destroyed model
                var query = {};
                query[lookupField.foreignKey] = model.attr(lookupField.referencedKey);
                Model.cache.query(query).forEach(function(model) {
                    // Stop referencing the deleted model
                    model.attr(lookupField.foreignKey, null);
                    model.attr(lookupField.label, null);
                    // No need to persist changes since the database
                    // already handles that with its ON DELETE ... clause
                    //model.save();
                });
            });
        });
    });
    
    AD.ServiceJSON = require('appdev/comm/serviceJSON');
    
    // Load the UI module
    AD.UI = $.extend(true, require('ui/UIBase'), require('ui/UI'));
    require('ui/ErrorWindow');
    require('ui/AppTabGroup');
    console.log('Loaded UI modules');
};

var install = function(options) {
    // Install the application if necessary
    return require('app/install').install();
};

var login = function(options) {
    var loginDfd = AD.Deferreds.login;
    AD.Auth.login().done(loginDfd.resolve).fail(loginDfd.reject);
    return loginDfd.promise();
};

var getViewer = function() {
    // Attempt to read the viewer out of the PropertyStore
    var serverBaseURL = AD.Defaults.serverBaseURL;
    var viewerData = AD.PropertyStore.get('viewer_data');
    if (viewerData && viewerData.server === serverBaseURL) {
        // The viewer information is cached and the server is the same, so use the cached viewer
        AD.setViewer(viewerData.viewer);
    }
    else if (AD.Defaults.serverStorageEnabled) {
        // Get the user's viewer data from the server, possibly causing an authentication request
        Ti.API.log('Requesting viewer information...');
        var getViewerDfd = $.Deferred();
        AD.ServiceJSON.post({
            url: '/api/site/viewer/whoAmI',
            success: function(response) {
                Ti.API.log('Viewer information received');
                var viewer = response.data;
                AD.PropertyStore.set('viewer_data', {
                    viewer: viewer,
                    server: AD.Defaults.serverBaseURL
                });
                AD.setViewer(viewer);
                getViewerDfd.resolve();
            },
            failure: function(error) {
                getViewerDfd.reject({
                    description: 'Could not resolve viewer',
                    technical: error,
                    fix: AD.Defaults.development ?
                        'Please verify the that "Server URL" application preference is set to the correct address and that the AppDev Node.js server is running.' :
                        'Please verify the that "Server URL" application preference is set to the correct address and that the server is accessible.',
                    actions: [{
                        title: 'preferences',
                        callback: 'preferences',
                        platform: 'Android'
                    }]
                });
            }
        });
        return getViewerDfd;
    }
    else {
        // Use a dummy viewer
        AD.setViewer({ viewer_id: AD.Defaults.viewerId });
    }
    // Return a deferred that resolves immediately
    return $.Deferred().resolve().promise();
};

var initialize = function(options) {
    // When all deferreds in this array have been resolved, then initialization has completed and initDfd will be resolved
    var initDfds = [];
    var initDfd = $.Deferred();
    
    // Initialize the property store
    AD.PropertyStore.read();
    
    // Add a new task, represented by a deferred, that must be completed during initialization
    var addInitDfd = function(newInitDfd) {
        // Only add initialization steps if initialization has not yet completed
        if (initDfd.state() === 'pending') {
            newInitDfd.fail(function(error) {
                initDfd.reject({
                    error: error,
                    dfd: newInitDfd
                });
            });
            initDfds.push(newInitDfd);
        }
    };
    
    // Resolve initDfd when all deferreds in initDfds have been resolved/rejected
    var initDfdsEmpty = false;
    var checkInitDone = function() {
        if (initDfdsEmpty && initDfds.length === 0) {
            // The deferred array was empty during last iteration and is still empty, so initialization is done
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
    initDfd.always(function() {
        clearInterval(checkInitInterval);
    });
    
    
    // Create the login window
    require('ui/LoginWindow');
    AD.winLogin = new AD.UI.LoginWindow();
    console.log('Created LoginWindow');
    
    var viewerDfd = getViewer().done(function() {
        addInitDfd(AD.Model.refreshCaches());
    });
    addInitDfd(viewerDfd);
    
    // getViewerStatus holds status information regarding the getViewer call
    var getViewerStatus = {
        dfd: viewerDfd
    };
    var serverBaseURLOld = AD.Defaults.syncEnabled && AD.Defaults.serverBaseURL; // false if sync is disabled
    var reloadViewerInterval = setInterval(function() {
        var serverBaseURL = AD.Defaults.syncEnabled && AD.Defaults.serverBaseURL; // false if sync is disabled
        var syncChanged = AD.Defaults.syncEnabled && serverBaseURL !== serverBaseURLOld;
        // True if the error window is open and the error was a result of this getViewer operation
        var errorDisplayed = AD.UI.$winError && AD.UI.$winError.operation === getViewerStatus.dfd;
        
        // Only retrieve the viewer if the sync server URL is changing, the getViewer error
        // window is not already open, and the AppDev initialization has already completed
        if (syncChanged && !errorDisplayed && initDfd.state() === 'resolved') {
            console.log('serverBaseURLOld: '+serverBaseURLOld+', serverBaseURL: '+serverBaseURL);
            console.log('Updating viewer...');
            serverBaseURLOld = serverBaseURL;
            getViewerStatus = AD.run(getViewer);
        }
    }, 5000);
    initDfd.always(function() {
        clearInterval(reloadViewerInterval);
    });
    
    console.log('Finished AppDev initialization');
    
    AD.UI.initialize = function() {
        if (!options.windows) {
            return;
        }
        
        var createTabGroup = function() {
            // Initialize the top-level UI
            AD.UI.$appTabGroup = new AD.UI.AppTabGroup({
                windows: options.windows
            });
            if (AD.Platform.isAndroid && AD.EncryptionKey.encryptionActivated()) {
                AD.UI.$appTabGroup.addEventListener('close', function() {
                    // Start the Android keepalive service
                    // It will keep the app running in the background for five minutes, giving the user
                    // a chance to reopen it with a relatively short PIN rather than a long password
                    Ti.App.Properties.setInt('killTime', Math.floor(Date.now() / 1000) + 5 * 60);
                    AD.Auth.storeEncryptedPassword();
                    Ti.Android.startService(AD.keepaliveIntent);
                });
            }
            AD.UI.$appTabGroup.open();
        };
        
        // When reinitializing the UI, create a new tab group, open it, then close the existing
        // tab group, and open it. On Android, the application is closed when the root tab
        // group is closed, so the new tab group must be created and opened before the old
        // tab group is closed to ensure that at least one tab group is open at all times.
        var $oldTabGroup = AD.UI.$appTabGroup;
        if ($oldTabGroup) {
            createTabGroup();
            $oldTabGroup.close();
        }
        else {
            createTabGroup();
        }
        
        console.log('AppDev UI initialized');
    };
    // Initialize the UI after initialization is completed
    return initDfd.done(AD.UI.initialize).promise();
};

AD.init = function(options) {
    var appDevInitCompleteDfd = $.Deferred();
    
    // Attempt an initialization
    var tryInit = function() {
        // If the initialization succeeds, resolve the appDevInitCompleteDfd deferred that was returned from this function.
        // It if fails, retry the initialization
        var initDfd = $.Deferred();
        initialize(options).then(initDfd.resolve, initDfd.reject).fail(function(data) {
            var error = data.error;
            AD.UI.displayError({
                error: error,
                actions: error.actions,
                retry: tryInit,
                operation: data.dfd
            });
        });
        initDfd.done(appDevInitCompleteDfd.resolve);
    };
    
    // Boot and install the application, then initialize it
    boot(options);
    login(options).done(function() {
        install(options).done(tryInit);
    });
    
    return appDevInitCompleteDfd.promise();
};

// Attach a failure handler to this deferred that will display an error window with an optional retry callback
AD.handleError = function(dfd, retry) {
    dfd.fail(function(error) {
        AD.UI.displayError({
            error: error,
            actions: error.actions,
            retry: retry,
            operation: dfd
        });
    });
};

// Run the function operation until it succeeds
AD.run = function(operation, context, args) {
    var operationDfd = null;
    var status = {
        dfd: operationDfd // this deferred will be replaced as the operation is re-run
    };
    var run = function() {
        status.dfd = operationDfd = operation.apply(context || this, args || []);
        AD.handleError(operationDfd, run);
    };
    run();
    return status;
};

// Set the AppDev viewer model instance
AD.setViewer = function(viewerData) {
    AD.Viewer = AD.Models.Viewer.model(viewerData);
};
