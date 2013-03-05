var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Class('AD.FileStore', {}, {
    init: function(options) {
        this.file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, options.fileName);
        this.data = this.file.exists() ? JSON.parse(AD.sjcl.decrypt(AD.EncryptionKey.get(), this.file.read().text)) : (options.defaultData || {});
    },
    
    getData: function() {
        return this.data;
    },
    setData: function(newData) {
        this.data = newData;
    },
    
    flush: function(data) {
        this.file.write(AD.sjcl.encrypt(AD.EncryptionKey.get(), JSON.stringify(this.data)));
    }
});
