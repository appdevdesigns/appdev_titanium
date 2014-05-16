var AD = require('AppDev');
var $ = require('jquery');

var StringPromptWindow = module.exports = $.Window('AppDev.UI.StringPromptWindow', {
    actions: [{
        title: 'cancel',
        callback: 'cancel',
        leftNavButton: true,
        enabled: function() {
            return this.options.cancelable;
        }
    }, {
        callback: 'onSubmit',
        menuItem: false,
        onClose: true
    }],
    defaults: {
        title: 'stringPromptDefaultTitle',
        message: 'stringPromptDefaultMessage',
        initial: '',
        doneText: 'done',
        cancelable: true,
        modal: true,
        // Called when validating string input
        // Return an object with the 'valid' field set to the validity of the input string
        // Optionally set the 'reason' field to the reason why the input is invalid
        validateCallback: function(input) {
            // By default, all input strings are valid
            return { valid: true };
        }
    }
}, {
    init: function(options) {
        $.extend(true, this.options, options);
        
        // Initialize the base $.Window object
        this._super({
            createParams: {
                layout: 'vertical'
            },
            title: this.options.title,
            focusedChild: 'string',
            autoOpen: true
        });
    },
    
    // Create child views
    create: function() {
        this.add('messageLabel', Ti.UI.createLabel({
            left: AD.UI.padding,
            top: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.small,
            text: AD.Localize(this.options.message)
        }));
        var string = this.add('string', Ti.UI.createTextField({
            left: AD.UI.padding,
            top: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: AD.UI.textFieldHeight,
            value: this.options.initial,
            font: AD.UI.Fonts.small,
            autocorrect: false,
            autocapitalization: Ti.UI.TEXT_AUTOCAPITALIZATION_NONE,
            borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED
        }));
        var doneButton = this.add('done', Ti.UI.createButton({
            top: AD.UI.padding,
            center: {x: AD.UI.screenWidth / 2},
            width: 80,
            height: AD.UI.buttonHeight,
            titleid: this.options.doneText
        }));
        var onSubmit = this.proxy('onSubmit'); // avoid creating two proxies of the same function
        doneButton.addEventListener('click', onSubmit);
        string.addEventListener('return', onSubmit);
        this.add('status', Ti.UI.createLabel({
            left: AD.UI.padding,
            top: AD.UI.padding * 2,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.small
        }));
    },
    
    onSubmit: function() {
        var value = this.getChild('string').value;
        var validity = this.options.validateCallback.call(this, value);
        if (validity.valid === true) {
            this.dfd.resolve(value);
        }
        else if (validity.valid === false) {
            this.getChild('status').text = AD.Localize(validity.reason || 'stringPromptInvalidInput');
        }
        else {
            throw 'Invalid "valid" field returned by validateCallback: ['+validity.valid+']!';
        }
        return validity.valid;
    }
});

// Create two specialized StringPromptWindow classes for handling encryption keys and login passwords

StringPromptWindow.extend('AppDev.UI.StringPromptWindow.EncryptionKey', {
    defaults: {
        title: 'stringPromptEncryptionTitle',
        message: 'stringPromptEncryptionMessage',
        validateCallback: function(input) {
            if (input.length < 30) {
                return { valid: false, reason: 'stringPromptEncryptionLengthConstraint' };
            }
            else {
                return { valid: true };
            }
        }
    }
}, {});

StringPromptWindow.extend('AppDev.UI.StringPromptWindow.LoginPassword', {
    defaults: {
        title: 'stringPromptPasswordTitle',
        message: 'stringPromptPasswordMessage',
        validateCallback: function(input) {
            if (!AD.Defaults.development && input.length < 30) {
                return { valid: false, reason: 'stringPromptPasswordLengthConstraint' };
            }
            else {
                return { valid: true };
            }
        }
    }
}, {});
