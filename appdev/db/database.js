var AD = require('AppDev');

var dmarieModulePath = 'appdev/db/dmarieDB-'+(Ti.Platform.osname);
var dmarieDB = require(dmarieModulePath);

module.exports = {
    open: function(dbName) {
        // Open the encrypted database
        return dmarieDB.openDB(dbName+'.sql', AD.EncryptionKey.get());
    }
};
