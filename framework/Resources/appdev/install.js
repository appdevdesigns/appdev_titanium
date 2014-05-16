var AD = require('AppDev');

// Return the version string as an array of its period delimited parts with the pre-release identifier removed
var parseVersion = function(version) {
    return /^([^\-]*)/.exec(version)[1].split('.');
};

// Return 1 if v1 is higher than v2, return -1 if v1 is lower than v2, and return 0 if they are equal
var compareVersions = module.exports.compareVersions = function(v1, v2) {
    var v1Parts = parseVersion(v1);
    var v2Parts = parseVersion(v2);
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

// Create the necessary databases for the application
var installDatabases = function(installData) {
    // Turn off iCloud backup for the database file
    var file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, AD.Defaults.dbName+'.sql');
    if (file.exists()) {
        file.remoteBackup = false;
    }
};

module.exports.install = function(hooks) {
    var $ = require('jquery');
    var dfd = $.Deferred();
    
    var currentVersion = Ti.App.Properties.getString('version');
    
    if (AD.Platform.isiOS && !currentVersion) {
        var password = require('com.0x82.key.chain').getPasswordForService('database_key', 'main');
        // Only if the password is stored in the 'database_key/main' keychain entry (only pre-1.1) will the PropertyStore be converted from the legacy format
        if (password) {
            // In earlier versions (until 1.1), the application version was stored in the encrypted
            // property store, now it is stored as an unencrypted application property
            
            // Open the encrypted PropertyStore using the LEGACY decryptor
            AD.EncryptionKey.set(password);
            AD.PropertyStore.read(true); // use the legacy decryptor
            
            // Read out the version property, then delete it
            currentVersion = AD.PropertyStore.get('version');
            AD.PropertyStore.remove('version');
            
            // The property store should be flushed because we are changing from the legacy decryptor
            // to the current decryptor, but it is unnecessary to manually flush the PropertyStore
            // because the call to AD.PropertyStore.remove(...) already does this
            //AD.PropertyStore.write();
        }
    }
    
    var installed = currentVersion ? true : false;
    if (!installed) {
        currentVersion = '0';
    }
    console.log('Installed: '+installed);
    console.log('Current version: '+currentVersion);
    console.log('AD.Defaults.version: '+AD.Defaults.version);
    if (compareVersions(AD.Defaults.version, currentVersion) > 0) {
        // (Re)install the application
        console.log((installed ? 'Upgrading' : 'Installing') + ' app from '+currentVersion+' to '+AD.Defaults.version+' ...');
        
        if (installed) {
            // Updating NextSteps
            
            if (AD.Platform.isiOS) {
                // Starting in 1.1, the password hash is stored as an application property, so calculate
                // this hash for earlier iOS versions where only the password was stored in the system keychain
                var keychain = require('com.0x82.key.chain');
                var password = keychain.getPasswordForService('database_key', 'main');
                if (password) {
                    // This will update the password hash and store the password under "<app-id>/database_encryption_key",
                    // instead of "database_key/main", to prevent conflict between multiple AppDev applications
                    AD.EncryptionKey.set(password);
                    
                    // Remove the now unneeded keychain password entry
                    keychain.deletePasswordForService('database_key', 'main');
                }
            }
            
            // The app is already installed, so do not prompt for the random database encryption key
            dfd.resolve({ updated: true });
        }
        else if (!AD.EncryptionKey.isEncrypted()) {
            // Encryption is unnecessary
            dfd.resolve({ installed: true });
        }
        else if (AD.Platform.isiOS) {
            // Installing on iOS
            
            if (AD.Defaults.localStorageEnabled) {
                // Prompt user for random string
                var StringPromptWindow = require('ui/StringPromptWindow');
                var $winStringPrompt = new StringPromptWindow.EncryptionKey({
                    cancelable: false
                });
                $winStringPrompt.getDeferred().done(function(randomString) {
                    // Generate a random key from the random string
                    var key = AD.EncryptionKey.generateKey(randomString);
                    AD.EncryptionKey.set(key);
                    
                    dfd.resolve({ installed: true });
                });
            }
            else {
                dfd.resolve({ installed: true });
            }
        }
        else {
            // Installing on Android
            
            // Determine whether to password-protect the application
            var protectionDfd = $.Deferred();
            var encryption = require('net.appdevdesigns.encryption');
            encryption.addEventListener('authorized', function() {
                console.log('Encryption authorized');
                
                // User accepted admin authorization request, so determine whether the device is encrypted
                var encryptionStatus = encryption.encryptionStatus();
                var encrypted = encryptionStatus === encryption.ENCRYPTION_STATUS_ACTIVATED;
                var encryptionSupported = encryptionStatus === encryption.ENCRYPTION_STATUS_INACTIVE;
                console.log('Encryption status: '+encryption.encryptionStatus());
                console.log('Encrypted: '+encrypted);
                console.log('Encryption supported: '+encryptionSupported);
                
                // Admin privileges are not needed anymore
                encryption.deauthorizeAdmin();
                
                if (encrypted) {
                    // The device is encrypted, so password protection is optional
                    AD.UI.yesNoAlert($.formatString('passwordProtectOptional', AD.Defaults.application)).then(protectionDfd.resolve, protectionDfd.resolve);
                }
                else {
                    // The device is not encrypted, so password protection is required
                    var passwordProtect = function() {
                        protectionDfd.resolve(true);
                    };
                    if (encryptionSupported) {
                        AD.UI.yesNoAlert($.formatString('recommendEncryption', AD.Defaults.application)).then(function() {
                            // Open a webpage with Android full-device encryption instructions
                            Ti.Platform.openURL('http://www.howtogeek.com/141953');
                            // Now close the application
                            Ti.Android.currentActivity.finish();
                        }, passwordProtect);
                    }
                    else {
                        AD.UI.okAlert($.formatString('passwordProtectRequired', AD.Defaults.application)).then(passwordProtect);
                    }
                }
            });
            encryption.addEventListener('authorizationRejected', function() {
                console.log('Encryption rejection');
                
                // User rejected admin authorization request, so force password protection
                protectionDfd.resolve(true);
            });
            encryption.authorizeAdmin();
            
            protectionDfd.done(function(passwordProtect) {
                console.log('Password protected: '+passwordProtect);
                
                var StringPromptWindow = require('ui/StringPromptWindow');
                var WindowClass = StringPromptWindow[passwordProtect ? 'LoginPassword' : 'EncryptionKey'];
                $winStringPrompt = new WindowClass({
                    cancelable: false
                });
                $winStringPrompt.getDeferred().done(function(password) {
                    if (passwordProtect) {
                        // Use the entered password as the password
                        AD.EncryptionKey.set(password);
                    }
                    else {
                        // Use the entered string to generate a random password, which is saved
                        var key = AD.EncryptionKey.generateKey(password);
                        AD.EncryptionKey.set(key);
                        Ti.App.Properties.setString('password', key);
                    }
                    
                    dfd.resolve({ installed: true });
                });
            });
        }
    }
    else {
        dfd.resolve({});
    }
    dfd.done(function(data) {
        if (data.installed || data.updated) {
            var DataStore = require('appdev/db/DataStoreSQLite');
            
            // This is the data that is passed to hooks
            var installData = {
                labels: null,
                previousVersion: currentVersion, // the app version before the upgrade
                currentVersion: AD.Defaults.version, // the app version after the upgrade
                dbName: AD.Defaults.dbName,
                query: function(query, values) {
                    // Run a database query
                    return DataStore.execute(installData.dbName, query, values);
                },
                installLabels: function(tableName) {
                    var table = installData.labels[tableName];
                    var dataTableName = tableName+'_data';
                    var transTableName = tableName+'_trans';
                    var getDataMgr = function(dbTable, model) {
                        return {
                            dbName: installData.dbName,
                            dbTable: dbTable,
                            model: $.extend(table.has_uuid ? {
                                viewer_id: AD.Defaults.viewerId,
                                device_id: Ti.Platform.id
                            } : {}, model),
                            joinedTables: [],
                            selectedFields: { _empty: true }
                        };
                    };
                    
                    table.labels.forEach(function(label) {
                        // Create the data table entry
                        DataStore.create(getDataMgr(dataTableName)).done(function(primaryKey) {
                            // Get the value of the linked field from the new entry
                            var getLinkedFieldDfd = $.Deferred();
                            if (table.has_uuid) {
                                DataStore.read(getDataMgr(dataTableName, $.makeObject([{
                                    key: table.primary_key,
                                    value: primaryKey
                                }]))).done(function(labelArgs) {
                                    getLinkedFieldDfd.resolve(labelArgs[0][0][table.linked_field]);
                                });
                            }
                            else {
                                getLinkedFieldDfd.resolve(primaryKey);
                            }
                            
                            // Create the trans table entries for each label
                            getLinkedFieldDfd.done(function(linkedField) {
                                $.each(label, function(language, label) {
                                    DataStore.create(getDataMgr(transTableName, $.makeObject([
                                        { key: table.linked_field, value: linkedField },
                                        { key: 'language_code', value: language },
                                        { key: table.label_field, value: label }
                                    ])));
                                });
                            });
                        });
                    });
                }
            };
            // Read in the labels data file
            var labelsFile = Titanium.Filesystem.getFile(Titanium.Filesystem.resourcesDirectory, 'labels.json');
            if (labelsFile.exists) {
                installData.labels = JSON.parse(labelsFile.read().text);
            }
            
            // Load the property store so that it will be accessible to the installer hooks
            AD.PropertyStore.read();
            
            if (AD.Defaults.localStorageEnabled) {
                installDatabases(installData);
                if (hooks && $.isFunction(hooks.installDatabases)) {
                    hooks.installDatabases(installData);
                }
            }
            
            // This property was removed after version 1.1
            AD.PropertyStore.remove('viewer');
            
            Ti.App.Properties.setString('version', AD.Defaults.version);
            
            if (hooks && $.isFunction(hooks.onInstall)) {
                hooks.onInstall(installData);
            }
            
            if (compareVersions(currentVersion, '0') > 0 && compareVersions(currentVersion, '1.5') < 0) {
                // Rename the file ServiceJSON.retryingRequests.json to HTTP.retryingRequests.json
                var file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, 'ServiceJSON.retryingRequests.json');
                file.rename('HTTP.retryingRequests.json');
            }
        }
    });
    return dfd.promise();
};
