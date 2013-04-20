var AD = require('AppDev');

// Return 1 if v1 is higher than v2, return -1 if v1 is lower than v2, and return 0 if they are equal
var compareVersions = function(v1, v2) {
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
    // Create the necessary database tables
    var DataStore = require('appdev/db/DataStoreSQLite');
    var dbName = AD.Defaults.dbName;
    var query = function(query, values) {
        DataStore.execute(dbName, query, values);
    };
    
    // Between 0 (uninstalled) and 1.1, exclusive
    var pre1_1 = compareVersions(dbVersion, '0') > 0 && compareVersions(dbVersion, '1.1') < 0;
    if (pre1_1) {
        // Add device_id columns
        query("ALTER TABLE nextsteps_contact ADD COLUMN device_id DEFAULT ?", [Ti.Platform.id]);
        query("ALTER TABLE nextsteps_group ADD COLUMN device_id DEFAULT ?", [Ti.Platform.id]);
        
        // Add and populate guid columns
        query("ALTER TABLE nextsteps_contact ADD COLUMN contact_guid DEFAULT NULL");
        query("UPDATE nextsteps_contact SET contact_guid = contact_id||'.'||device_id");
        query("ALTER TABLE nextsteps_group ADD COLUMN group_guid DEFAULT NULL");
        query("UPDATE nextsteps_group SET group_guid = group_id||'.'||device_id");
        
        // Contact year_id is now a 1-based index, rather than a 0-based index
        query("UPDATE nextsteps_contact SET year_id = year_id+1");
        
        // Rename the nextsteps_contact table so that it will be recreated
        query("ALTER TABLE nextsteps_contact RENAME TO nextsteps_contact_temp");
    }
    
    query("CREATE TABLE IF NOT EXISTS site_viewer (\
               viewer_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
               language_key TEXT DEFAULT 'en',\
               viewer_passWord TEXT,\
               viewer_userID TEXT,\
               viewer_isActive INTEGER DEFAULT 0,\
               viewer_lastLogin TEXT DEFAULT NULL,\
               viewer_globalUserID TEXT\
           )");
    query("CREATE TABLE IF NOT EXISTS nextsteps_contact (\
               contact_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
               contact_guid TEXT DEFAULT NULL,\
               viewer_id INTEGER NOT NULL,\
               device_id TEXT NOT NULL,\
               contact_recordId INTEGER,\
               contact_firstName TEXT NOT NULL,\
               contact_lastName TEXT NOT NULL,\
               contact_nickname TEXT,\
               contact_campus TEXT,\
               year_id INTEGER NOT NULL DEFAULT 1,\
               contact_phone TEXT,\
               contact_phoneId TEXT,\
               contact_email TEXT,\
               contact_emailId TEXT,\
               contact_notes TEXT,\
               contact_preEv TEXT DEFAULT NULL,\
               contact_conversation TEXT DEFAULT NULL,\
               contact_Gpresentation TEXT DEFAULT NULL,\
               contact_decision TEXT DEFAULT NULL,\
               contact_finishedFU TEXT DEFAULT NULL,\
               contact_HSpresentation TEXT DEFAULT NULL,\
               contact_engaged TEXT DEFAULT NULL,\
               contact_ministering TEXT DEFAULT NULL,\
               contact_multiplying TEXT DEFAULT NULL\
           )");
    query("CREATE TRIGGER IF NOT EXISTS contact_guid AFTER INSERT ON nextsteps_contact FOR EACH ROW\
           BEGIN\
               UPDATE nextsteps_contact SET contact_guid = NEW.contact_id||'.'||NEW.device_id WHERE contact_id=NEW.contact_id;\
           END");
    query("CREATE TABLE IF NOT EXISTS nextsteps_group (\
               group_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
               group_guid TEXT DEFAULT NULL,\
               viewer_id INTEGER NOT NULL,\
               device_id TEXT NOT NULL,\
               group_name TEXT NOT NULL,\
               group_filter TEXT NOT NULL\
           )");
    query("CREATE TRIGGER IF NOT EXISTS group_guid AFTER INSERT ON nextsteps_group FOR EACH ROW\
           BEGIN\
               UPDATE nextsteps_group SET group_guid = NEW.group_id||'.'||NEW.device_id WHERE group_id=NEW.group_id;\
           END");
    
    query("CREATE TABLE IF NOT EXISTS nextsteps_year_data (\
               year_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE\
           )");
    query("CREATE TABLE IF NOT EXISTS nextsteps_year_trans (\
               trans_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
               year_id INTEGER NOT NULL DEFAULT 1,\
               language_code TEXT NOT NULL DEFAULT '',\
               year_label text NOT NULL\
           )");
    // Empty the tables and recreate the year labels
    query("DELETE FROM nextsteps_year_data");
    query("DELETE FROM nextsteps_year_trans");
    var yearLabels = ['Unknown', 'Freshman', 'Sophmore', 'Junior', 'Senior', 'Graduated', 'Teacher', 'Other'];
    yearLabels.forEach(function(yearLabel, index) {
        var id = index + 1;
        query("INSERT INTO nextsteps_year_data (year_id) VALUES (?)", [id]);
        query("INSERT INTO nextsteps_year_trans (trans_id, year_id, language_code, year_label) VALUES (?, ?, 'en', ?)", [id, id, yearLabel]);
    });
    
    if (pre1_1) {
        // After recreating the nextsteps_contact table, copy contact data back in
        var fields = 'contact_id, contact_guid, viewer_id, device_id, contact_recordId, contact_firstName, contact_lastName, contact_nickname, contact_campus, year_id, contact_phone, contact_phoneId, contact_email, contact_emailId, contact_notes, contact_preEv, contact_conversation, contact_Gpresentation, contact_decision, contact_finishedFU, contact_HSpresentation, contact_engaged, contact_ministering, contact_multiplying';
        query("INSERT INTO nextsteps_contact ("+fields+") SELECT "+fields+" FROM nextsteps_contact_temp", [fields, fields]);
        query("DROP TABLE nextsteps_contact_temp");
        
        // Now contact_recordId of NULL, rather than -1, refers to a contact not in the address book
        query("UPDATE nextsteps_contact SET contact_recordId = NULL WHERE contact_recordId = -1");
    }
    
    // Turn off iCloud backup for the database file
    var file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dbName+'.sql');
    file.remoteBackup = false;
};

module.exports.install = function() {
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
            }
            
            // This property was removed after version 1.1
            AD.PropertyStore.remove('viewer');
            
            Ti.App.Properties.setString('version', AD.Defaults.version);
            // Set the campus list to an empty array if the property does not exist yet
            AD.PropertyStore.setDefault('campuses', []);
        }
    });
    return dfd.promise();
};
