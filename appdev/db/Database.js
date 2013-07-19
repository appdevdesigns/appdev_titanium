var AD = require('AppDev');

var dmarieModulePath = 'appdev/db/dmarieDB-'+(Ti.Platform.osname);
var dmarieDB = require(dmarieModulePath);

module.exports = {
    open: function(dbName) {
        // Open the encrypted database
        var dbFile = dbName+'.sql';
        var db = AD.EncryptionKey.isEncrypted() ? dmarieDB.openDB(dbFile, AD.EncryptionKey.get()) : Ti.Database.open(AD.Platform.isAndroid ? dbFile : dbName);
        
        // Automatically enable foreign key support, which is disabled by default
        db.execute('PRAGMA foreign_keys = ON');
        return db;
    },
    
    DataStore: require('appdev/db/DataStoreSQLite')
};
