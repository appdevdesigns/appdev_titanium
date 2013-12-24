var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Class('AD.FileStore', {}, {
    init: function(options) {
        this.file = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, options.fileName);
        if (this.file.exists()) {
            var text = this.file.read().text;
            this.data = JSON.parse(AD.EncryptionKey.isEncrypted() ? AD.sjcl.decrypt(AD.EncryptionKey.get(), text) : text);
        }
        else {
            this.data = options.defaultData || {};
        }
    },
    
    getData: function() {
        return this.data;
    },
    setData: function(newData) {
        this.data = newData;
    },
    
    flush: function() {
        var text = JSON.stringify(this.data);
        this.file.write(AD.EncryptionKey.isEncrypted() ? AD.sjcl.encrypt(AD.EncryptionKey.get(), text) : text);
    }
});
