var AD = require('AppDev');

// Return 1 if v1 is higher than v2, return -1 if v1 is lower than v2, and return 0 if they are equal
var compareVersions = module.exports.compareVersions = function(v1, v2) {
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

// Create the necessary databases for the application
var installDatabases = function(dbVersion) {
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
                var $winStringPrompt = new StringPromptWindow.EncryptionKey();
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
                // User accepted admin authorization request, so determine whether the device is encrypted
                var encrypted = encryption.encryptionStatus() === encryption.ENCRYPTION_STATUS_ACTIVATED;
                
                // Admin privileges are not needed anymore
                encryption.deauthorizeAdmin();
                
                if (encrypted) {
                    // The device is encrypted, so password protection is optional
                    AD.UI.yesNoAlert($.formatString('passwordProtectOptional', AD.Defaults.application)).then(protectionDfd.resolve, protectionDfd.resolve);
                }
                else {
                    // The device is not encrypted, so password protection is required
                    AD.UI.okAlert($.formatString('passwordProtectRequired', AD.Defaults.application), true).then(protectionDfd.resolve);
                }
            });
            encryption.addEventListener('authorizationRejected', function() {
                // User rejected admin authorization request, so force password protection
                protectionDfd.resolve(false);
            });
            encryption.authorizeAdmin();
            
            protectionDfd.done(function(passwordProtect) {
                console.log(passwordProtect);
                var StringPromptWindow = require('ui/StringPromptWindow');
                var WindowClass = StringPromptWindow[passwordProtect ? 'LoginPassword' : 'EncryptionKey'];
                $winStringPrompt = new WindowClass();
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
            if (AD.Defaults.localStorageEnabled) {
                installDatabases(currentVersion);
                if (hooks && $.isFunction(hooks.installDatabases)) {
                    hooks.installDatabases(currentVersion);
                }
            }
            
            // This property was removed after version 1.1
            AD.PropertyStore.remove('viewer');
            
            Ti.App.Properties.setString('version', AD.Defaults.version);
            
            if (hooks && $.isFunction(hooks.onInstall)) {
                hooks.onInstall(currentVersion);
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
