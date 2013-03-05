var AD = require('AppDev');
var $ = require('jquery');

// Crypto-js library is hosted on http://code.google.com/p/crypto-js/
var CryptoJS = require('cryptojs');
var JSONFormatter = {
    stringify: function(cipherParams) {
        // create json object with ciphertext
        var jsonObj = {
            ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64)
        };

        // optionally add iv and salt
        if (cipherParams.iv) {
            jsonObj.iv = cipherParams.iv.toString();
        }
        if (cipherParams.salt) {
            jsonObj.s = cipherParams.salt.toString();
        }

        // stringify json object
        return JSON.stringify(jsonObj);
    },

    parse: function(jsonStr) {
        // parse json string
        var jsonObj = JSON.parse(jsonStr);

        // extract ciphertext from json object, and create cipher params object
        var cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
        });

        // optionally extract iv and salt
        if (jsonObj.iv) {
            cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
        }
        if (jsonObj.s) {
            cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
        }

        return cipherParams;
    }
};

module.exports = PropertyStore = {
    store: {},
    
    get: function(name) {
        return this.store[name];
    },
    set: function(name, value) {
        this.store[name] = value;
        this.update(name);
    },
    setDefault: function(name, value) {
        if (typeof this.get(name) === 'undefined') {
            // Set the property only if it has not been set before
            this.set(name, value);
        }
    },
    update: function(name) {
        this.trigger(name, [this.get(name)]);
        this.write();
    },
    remove: function(name) {
        delete this.store[name];
        this.update(name);
    },
    
    read: function() {
        var key = AD.EncryptionKey.get();
        if (!key && AD.Platform.isiOS) {
            // Encryption key has not been generated yet
            return;
        }
        
        var propertyStore = Ti.App.Properties.getString('property_store');
        var decrypted = '{}';
        if (propertyStore) {
            // Import the encrypted property store from Tianium.App.Properties
            decrypted = key ? CryptoJS.AES.decrypt(propertyStore, key, {format: JSONFormatter}).toString(CryptoJS.enc.Utf8) : propertyStore;
        }
        var store = JSON.parse(decrypted);
        // Call PropertyStore.set for each property so that triggers will be called
        $.each(store, $.proxy(this, 'set'));
    },
    write: function() {
        var key = AD.EncryptionKey.get();
        if (!key && AD.Platform.isiOS) {
            // Encryption key has not been generated yet
            return;
        }
        
        // Export the encrypted property store to Ti.App.Properties
        var propertyStore = JSON.stringify(this.store);
        var encrypted = key ? CryptoJS.AES.encrypt(propertyStore, key, {format: JSONFormatter}).toString() : propertyStore;
        Ti.App.Properties.setString('property_store', encrypted);
    }
};
// Add the jQuery bind, unbind, and trigger methods to the PropertyStore
['bind', 'unbind', 'trigger'].forEach(function(name) {
    PropertyStore[name] = function() {
        return $.fn[name].apply($([this]), arguments);
    };
});

// Initialize the property store
PropertyStore.read();
