var $ = require('jquery');
var AD = require('AppDev');

var dmarieModulePath = 'appdev/db/dmarieDB-'+(Ti.Platform.osname);
var dmarieDB = require(dmarieModulePath);

var Database = module.exports = {
    // Return the file on the filesystem that represents the database
    getFile: function() {
        var directoryPath = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory).resolve();
        if (AD.Platform.isiOS && !AD.EncryptionKey.isEncrypted()) {
            // Unencrypted databases are stored in Library/Private Documents on iOS
            directoryPath = Ti.Filesystem.getFile(directoryPath, '..', 'Library', 'Private Documents').resolve();
        }
        return Ti.Filesystem.getFile(directoryPath, AD.Defaults.dbName+'.sql');
    },
    
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
        return Database.DataStore.exportDatabase(dbName).done(function(dump) {
            // Do not backup the these system-generated tables
            var ignoredTables = ['android_metadata', 'sqlite_sequence'];
            ignoredTables.forEach(function(tableName) {
                delete dump.tables[tableName];
            });
            
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
        
        // The "tables" property is now a dictionary of table name, table data pairs
        $.each(dump.tables, function(tableName, table) {
            if (!$.isArray(table)) {
                dump.tables[tableName] = table.data;
            }
        });
        
        var dumpVersion = dump.version;
        var compareVersions = require('appdev/install').compareVersions;
        require('app/install').upgraders.filter(function(upgrader) {
            // Only include upgraders that upgrade to versions higher than the database dump version
            return compareVersions(upgrader.version, dumpVersion) > 0;
        }).sort(function(upgrader1, upgrader2) {
            return compareVersions(upgrader1.version, upgrader2.version);
        }).forEach(function(upgrader) {
            // Run the upgrader on the database dump
            dump = upgrader.upgrade(dump);
        });
        return Database.DataStore.importDatabase(dbName, dump);
    },
    
    DataStore: require('appdev/db/DataStoreSQLite')
};
