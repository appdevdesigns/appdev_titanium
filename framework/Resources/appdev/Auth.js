var AD = require('AppDev');
var $ = require('jquery');

var Auth = module.exports = {};

// Prompt the user to choose a password
Auth.chooseEncryptionKey = function() {
    // Prompt user for random string
    var StringPromptWindow = require('ui/StringPromptWindow');
    var $winStringPrompt = new StringPromptWindow.EncryptionKey({
        cancelable: false
    });
    return $winStringPrompt.getDeferred().done(function(randomString) {
        // Generate a random key from the random string
        var key = AD.EncryptionKey.generateKey(randomString);
        AD.EncryptionKey.set(key);
    });
};

// Prompt the user to choose a password
Auth.choosePassword = function() {
    // Prompt user for random string
    var StringPromptWindow = require('ui/StringPromptWindow');
    var $winStringPrompt = new StringPromptWindow.LoginPassword({
        cancelable: false
    });
    return $winStringPrompt.getDeferred().done(function(password) {
        // Use the entered password as the password
        AD.EncryptionKey.set(password);
    });
};

// Prompt the user to choose a PIN
Auth.choosePIN = function() {
    var StringPromptWindow = require('ui/StringPromptWindow');
    var $winPinPrompt = new StringPromptWindow.PIN({
        cancelable: false
    });
    return $winPinPrompt.getDeferred().done(function(pin) {
        // Load the property store and set the chosen PIN
        AD.PropertyStore.read();
        AD.PropertyStore.set('PIN', pin);
    });
};

Auth.login = function() {
    var loginDfd = $.Deferred();
    var password = Ti.App.Properties.getString('password');
    var encryptedPassword = Ti.App.Properties.getString('encryptedPassword');
    AD.EncryptionKey.passwordHash = Ti.App.Properties.getString('passwordHash');
    if (!AD.EncryptionKey.encryptionActivated()) {
        // The device is not encrypted so login is unnecessary
        loginDfd.resolve(true);
    }
    else if (!AD.EncryptionKey.passwordHash) {
        // The password hash has not been set yet, so login is impossible
        // Either the application has not yet been installed, this is a pre-1.1 version that has yet
        // to be upgraded, or this is an unencrypted installation
        loginDfd.resolve(true);
    }
    else if (!AD.Defaults.localStorageEnabled) {
        // Local storage is disabled, so there is no reason to force the user to login
        loginDfd.resolve(true);
    }
    else if (AD.EncryptionKey.get()) {
        // User is already logged in
        loginDfd.resolve(true);
    }
    else if (password) {
        // Login using the stored password
        AD.EncryptionKey.login(password);
        loginDfd.resolve(true);
    }
    else if (encryptedPassword) {
        // Login using the stored encryption key, which is encrypted using the user's PIN
        Auth.loginWithPIN().done(loginDfd.resolve);
    }
    else if (AD.Platform.isiOS) {
        // On iOS, login using the password from the keychain
        password = AD.EncryptionKey.readKeychain();
        AD.EncryptionKey.login(password);
        loginDfd.resolve(true);
    }
    else {
        // Ask the user for their login password
        Auth.loginWithPassword().done(loginDfd.resolve);
    }
    loginDfd.done(function(success) {
        console.log('Logged in successfully!');
    });
    return loginDfd.promise();
};

// Prompt the user to login using their password
Auth.loginWithPassword = function() {
    var loginDfd = $.Deferred();
    var PasswordPromptWindow = require('ui/PasswordPromptWindow');
    var $winPasswordPrompt = new PasswordPromptWindow({
        title: 'passwordPromptLoginTitle',
        message: 'passwordPromptLoginMessage',
        doneText: 'login',
        cancelable: false,
        passwordHash: AD.EncryptionKey.passwordHash
    });
    $winPasswordPrompt.getDeferred().done(function(password) {
        AD.EncryptionKey.login(password);
        loginDfd.resolve(true);
    }).fail(loginDfd.reject);
    return loginDfd.promise();
};

// Prompt the user to login using their login PIN
Auth.loginWithPIN = function() {
    var loginDfd = $.Deferred();
    var PasswordPromptWindow = require('ui/PasswordPromptWindow');
    var encryptedPassword = Ti.App.Properties.getString('encryptedPassword');
    var decryptedPassword = null;
    var $winPasswordPrompt = new PasswordPromptWindow({
        title: 'pinPromptLoginTitle',
        message: 'pinPromptLoginMessage',
        doneText: 'login',
        cancelable: true,
        keyboardType: Ti.UI.KEYBOARD_NUMBER_PAD,
        verifyCallback: function(pin) {
            try {
                // Decrypt the encrypted password using the provided pin
                decryptedPassword = AD.sjcl.decrypt(pin, encryptedPassword);
            }
            catch(e) {
                // Error during decryption, probably because the pin was incorrect
                return false;
            }
            // Then check whether the hash of the decrypted password matches the stored password hash
            return AD.EncryptionKey.hash(decryptedPassword) === AD.EncryptionKey.passwordHash;
        }
    });
    $winPasswordPrompt.getDeferred().done(function(pin) {
        // Erase the stored encrypted password for security reasons
        Ti.App.Properties.removeProperty('encryptedPassword');
        
        // Login using the decrypted password
        AD.EncryptionKey.login(decryptedPassword);
        loginDfd.resolve(true);
    }).fail(function() {
        // Login with password
        Auth.loginWithPassword().done(loginDfd.resolve).fail(loginDfd.reject);
    });
    return loginDfd.promise();
};

// Encrypt the encryption key with the user's PIN and store it in the insecure Android storage
// It will remain until the keepalive service removes it when it kills the app
Auth.storeEncryptedPassword = function() {
    if (AD.Defaults.localStorageEnabled && AD.EncryptionKey.encryptionActivated()) {
        // The PIN-encrypted password backdoor is only necessary when database storage is enabled and encryption is activated
        Ti.App.Properties.setString('encryptedPassword', AD.sjcl.encrypt(AD.PropertyStore.get('PIN'), AD.EncryptionKey.get()));
    }
};
