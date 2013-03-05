// Database abstraction module, implements encrypted dmarie database on iOS and Titanium.Database on Android

var AD = require('AppDev');
if (AD.Platform.isiOS) {
    var dmarieDB = require('db/dmarieDB');
    
    module.exports = {
        open: function(dbName) {
            // Open the encrypted database
            return dmarieDB.openDB(dbName+'.sql', AD.EncryptionKey.get());
        }
    };
}
else {
    module.exports = Titanium.Database;
}
