var $ = require('jquery');
var AD = require('AppDev');

var dmarieModulePath = 'appdev/db/dmarieDB-'+(Ti.Platform.osname);
var dmarieDB = require(dmarieModulePath);

var Database = module.exports = {
    open: function(dbName) {
        // Open the encrypted database
        var dbFile = dbName+'.sql';
        var db = AD.EncryptionKey.isEncrypted() ? dmarieDB.openDB(dbFile, AD.EncryptionKey.get()) : Ti.Database.open(AD.Platform.isAndroid ? dbFile : dbName);
        
        // Automatically enable foreign key support, which is disabled by default
        db.execute('PRAGMA foreign_keys = ON');
        return db;
    },
    
    // Backup the database to a JSON dump
    export: function(dbName) {
        return Database.DataStore.export(dbName).done(function(dump) {
            dump.appName = Ti.App.name;
            dump.appId = Ti.App.id;
            dump.database = dbName;
            dump.version = AD.Defaults.version;
            return dump;
        });
    },
    
    // Restore the database from a JSON dump
    import: function(dbName, dump) {
        var error = null;
        if (dump.appName !== Ti.App.name || dump.appId !== Ti.App.id) {
            // Mismatched applications
            error = 'Cannot import database from application "'+dump.appName+'" ('+dump.appId+') into application "'+Ti.App.name+'" ('+Ti.App.id+')!';
        }
        else if (dump.database !== dbName) {
            // Mismatched databases
            error = 'Cannot import database "'+dump.database+'" into "'+dbName+'"!';
            return $.Deferred().reject();
        }
        if (error) {
            // Display the error message and abort
            alert(error);
            console.warn(error);
            return $.Deferred().reject();
        }
        return Database.DataStore.import(dbName, dump);
    },
    
    DataStore: require('appdev/db/DataStoreSQLite')
};
