var AD = require('AppDev');

require('ui/StringPromptWindow');

module.exports = AD.UI.StringPromptWindow('AppDev.UI.PasswordPromptWindow', {
    defaults: {
        title: 'passwordPromptDefaultTitle',
        message: 'passwordPromptDefaultMessage',
        password: null,
        verifyCallback: null,
        validateCallback: function(inputPassword) {
            var correct = false;
            if (this.options.password !== null) {
                // If the correct password was supplied, simply compare the input password to the correct password
                correct = inputPassword === this.options.password;
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
