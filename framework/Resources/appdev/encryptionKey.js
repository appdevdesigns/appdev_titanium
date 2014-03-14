var AD = require('AppDev');

var EncryptionKey = module.exports = {
    keySize: 512, // in bits
    saltSize: 256, // in bits
    iterations: 0, // will be set further down
    minIterations: 1000, // always use at least 1000 PBKDF2 iterations, even on slower devices, unless running from the simulator
    optimalHashTime: 3000, // generating the PBKDF2 hash should ideally take about this long in milliseconds
    password: null,
    passwordSalt: null,
    passwordHash: null,
    hashCache: {},
    hash: function(password, useCache) {
        // useCache defaults to true
        if (useCache !== false) {
            useCache = true;
        }
        
        var cacheEntry = EncryptionKey.hashCache[password];
        if (useCache && cacheEntry) {
            return cacheEntry;
        }
        else {
            // Use PBKDF2 to generate the password hash
            var start = Date.now();
            var hash = AD.sjcl.codec.hex.fromBits(AD.sjcl.misc.pbkdf2(password, EncryptionKey.passwordSalt, EncryptionKey.iterations, EncryptionKey.keySize));
            console.info(EncryptionKey.iterations+' PBKDF2 iterations in '+(Date.now() - start)+' ms');
            if (useCache) {
                EncryptionKey.hashCache[password] = hash;
            }
            return hash;
        }
    },
    generateKey: function(randomString) {
        // Return a very random key generated by hashing the combination of a random string and the current time
        return Ti.Utils.sha256(randomString + Date.now());
    },
    isEncrypted: function() {
        return AD.Defaults.alwaysEncrypt || !AD.Defaults.development;
    },
    get: function() {
        return EncryptionKey.password; // will be null if not logged in
    },
    login: function(password) {
        var passwordHash = EncryptionKey.hash(password);
        if (passwordHash === EncryptionKey.passwordHash) {
            EncryptionKey.password = password;
            EncryptionKey.passwordHash = passwordHash;
        }
        else {
            throw 'Invalid password: "'+password+'"!';
        }
    },
    set: function(password) {
        EncryptionKey.password = password;
        EncryptionKey.passwordHash = EncryptionKey.hash(password);
        Ti.App.Properties.setString('passwordHash', EncryptionKey.passwordHash);
        if (AD.Platform.isiOS) {
            EncryptionKey.writeKeychain(password);
        }
    },
    readKeychain: function() {
        return require('com.0x82.key.chain').getPasswordForService(Ti.App.id, 'database_encryption_key');
    },
    writeKeychain: function(password) {
        require('com.0x82.key.chain').setPasswordForService(password, Ti.App.id, 'database_encryption_key');
    }
};
var salt = Ti.App.Properties.getString('passwordSalt');
if (salt) {
    salt = EncryptionKey.passwordSalt = AD.sjcl.codec.hex.toBits(salt);
}
else {
    // Generate the password salt
    salt = EncryptionKey.passwordSalt = AD.sjcl.random.randomWords(EncryptionKey.saltSize / 32, 0);
    Ti.App.Properties.setString('passwordSalt', AD.sjcl.codec.hex.fromBits(salt));
}

var iterations = EncryptionKey.iterations = Ti.App.Properties.getInt('iterations');
if (!iterations) {
    // See how long it takes to complete 100 iterations
    var testIterations = 100;
    var timeStart = Date.now();
    EncryptionKey.iterations = testIterations;
    EncryptionKey.hash('test', false);
    var timeEnd = Date.now();
    var timeElapsed = timeEnd - timeStart;
    
    // Calculate the number of PBKDF2 iterations to use so that it will
    // take approximately EncryptionKey.optimalHashTime milliseconds to hash
    iterations = EncryptionKey.iterations = AD.Defaults.development ? 1 : Math.max(Math.floor(EncryptionKey.optimalHashTime * testIterations / timeElapsed), EncryptionKey.minIterations);
    Ti.App.Properties.setInt('iterations', iterations);
    console.log('Using '+iterations+' PBKDF2 iterations');
}

