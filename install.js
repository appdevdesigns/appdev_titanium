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
var createDatabases = function() {
    // Create the necessary database tables
    var DataStore = require('db/DataStoreSQLite');
    var dbName = AD.Defaults.dbName;
    DataStore.execute(dbName, "CREATE TABLE IF NOT EXISTS site_viewer (\
                                   viewer_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                                   language_key TEXT DEFAULT 'en',\
                                   viewer_passWord TEXT,\
                                   viewer_userID TEXT,\
                                   viewer_isActive INTEGER DEFAULT 0,\
                                   viewer_lastLogin TEXT DEFAULT NULL,\
                                   viewer_globalUserID TEXT\
                               )");
    DataStore.execute(dbName, "CREATE TABLE IF NOT EXISTS nextsteps_contact (\
                                   contact_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                                   viewer_id INTEGER NOT NULL,\
                                   contact_recordId INTEGER NOT NULL,\
                                   contact_firstName TEXT NOT NULL,\
                                   contact_lastName TEXT NOT NULL,\
                                   contact_nickname TEXT,\
                                   contact_campus TEXT,\
                                   year_id INT NOT NULL DEFAULT '0',\
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
    DataStore.execute(dbName, "CREATE TABLE IF NOT EXISTS nextsteps_group (\
                                   group_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                                   viewer_id INTEGER NOT NULL,\
                                   group_name TEXT NOT NULL,\
                                   group_filter TEXT NOT NULL\
                               )");
    
    DataStore.execute(dbName, "CREATE TABLE IF NOT EXISTS nextsteps_year_data (\
                                   year_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE\
                               )");
    DataStore.execute(dbName, "CREATE TABLE IF NOT EXISTS nextsteps_year_trans (\
                                   trans_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                                   year_id INTEGER NOT NULL DEFAULT '0',\
                                   language_code TEXT NOT NULL DEFAULT '',\
                                   year_label text NOT NULL\
                               )");
    // Empty the tables and recreate the year labels
    DataStore.execute(dbName, "DELETE FROM nextsteps_year_data");
    DataStore.execute(dbName, "DELETE FROM nextsteps_year_trans");
    var yearLabels = ['Unknown', 'Freshman', 'Sophmore', 'Junior', 'Senior', 'Graduated', 'Teacher', 'Other'];
    for (var i = 0; i < yearLabels.length; ++i) {
        DataStore.execute(dbName, "INSERT INTO nextsteps_year_data (year_id) VALUES (?)", [i]);
        DataStore.execute(dbName, "INSERT INTO nextsteps_year_trans (trans_id, year_id, language_code, year_label) VALUES (?, ?, 'en', ?)", [i, i, yearLabels[i]]);
    }
    
    
    // Turn off iCloud backup for the database file
    //var file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dbName+'.sql');
    //file.remoteBackup = false;
    //file = null;
};

module.exports.install = function() {
    var $ = require('jquery');
    var dfd = $.Deferred();
    
    var currentVersion = AD.PropertyStore.get('version');
    if (compareVersions(AD.Defaults.version, currentVersion || '0') > 0) {
        var installed = currentVersion ? true : false;
        
        // (Re)Install the application
        Ti.API.log((installed ? 'Upgrading' : 'Installing') + ' app...');
        
        if (installed) {
            // Updating NextSteps
            
            // The app is already installed or this is not iOS, so do not propmpt for the random database encryption key
            dfd.resolve({ updated: true });
        }
        else if (AD.Platform.isiOS) {
            // Installing on iOS
            
            if (AD.Defaults.localStorageEnabled) {
                // Prompt user for random string
                var StringPromptWindow = require('ui/StringPromptWindow');
                var $winStringPrompt = new StringPromptWindow();
                $winStringPrompt.getDeferred().done(function(randomString) {
                    // Combine the string with the current time in milliseconds and hash the
                    // result to obtain a very random key used to encrypt/decrypt the database
                    var key = Ti.Utils.sha256(randomString + Date.now());
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
            dfd.resolve({ installed: true });
        }
    }
    else {
        dfd.resolve({});
    }
    dfd.done(function(data) {
        if (data.installed || data.updated) {
            if (AD.Defaults.localStorageEnabled) {
                createDatabases();
            }
            
            AD.PropertyStore.set('version', AD.Defaults.version);
            // Set the campus list to an empty array if the property does not exist yet
            AD.PropertyStore.setDefault('campuses', []);
        }
    })
    return dfd.promise();
};
