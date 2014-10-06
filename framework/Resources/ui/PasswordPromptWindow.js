var AD = require('AppDev');

require('ui/StringPromptWindow');

module.exports = AD.UI.StringPromptWindow('AppDev.UI.PasswordPromptWindow', {
    defaults: {
        title: 'passwordPromptDefaultTitle',
        message: 'passwordPromptDefaultMessage',
        password: null,
        passwordHash: null,
        verifyCallback: null,
        validateCallback: function(inputPassword) {
            var correct = false;
            this.getChild('status').text = AD.localize('verifying')+'...';
            if (this.options.password !== null) {
                // If the correct password was supplied, simply compare the input password to the correct password
                correct = inputPassword === this.options.password;
            }
            if (this.options.passwordHash !== null) {
                // If the correct password hash was supplied, compare the hashed input password to the correct password hash
                correct = AD.EncryptionKey.hash(inputPassword) === this.options.passwordHash;
            }
            else if (this.options.verifyCallback) {
                // Run verifyCallback to determine whether or not the input password was correct
                correct = this.options.verifyCallback.apply(this, arguments);
            }
            else {
                throw 'No password or verifyCallback passed to PasswordPromptWindow to verify input passwords!';
            }
            
            return {
                valid: correct,
                reason: AD.localize(correct ? 'correct' : 'incorrect')+'!'
            };
        }
    }
}, {
    // Initialize the child views
    initialize: function() {
        // Give the input string field a password mask
        this.getChild('string').passwordMask = true;
    }
});
