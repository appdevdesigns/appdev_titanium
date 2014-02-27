var AD = require('AppDev');
var ADinstall = require('appdev/install');

module.exports.install = function() {
    return ADinstall.install({
        installDatabases: installDatabases,
        onInstall: onInstall
    });
};

// Called when the app is installed or updated
var onInstall = function(currentVersion) {
};

// Create the necessary databases for the application
var installDatabases = function(dbVersion) {
    // Create the necessary database tables
    var DataStore = require('appdev/db/DataStoreSQLite');
    var dbName = AD.Defaults.dbName;
    var query = function(query, values) {
        return DataStore.execute(dbName, query, values);
    };
};
