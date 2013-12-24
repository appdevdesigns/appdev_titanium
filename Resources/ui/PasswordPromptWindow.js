var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.PasswordPrompt', {
    defaults: {
        title: 'passwordPromptDefaultTitle',
        message: 'passwordPromptDefaultMessage',
        password: null,
        verifyCallback: null
    }
}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            createParams: {
                layout: 'vertical'
            },
            title: AD.Localize(this.options.title),
            focusedChild: 'password',
            autoOpen: true,
            modal: true
        });
        this.status = this.getChild('status');
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
        var password = this.add('password', Ti.UI.createTextField({
            left: AD.UI.padding,
            top: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: AD.UI.textFieldHeight,
            font: AD.UI.Fonts.small,
            passwordMask: true,
            autocorrect: false,
            autocapitalization: Ti.UI.TEXT_AUTOCAPITALIZATION_NONE,
            borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED
        }));
        var doneButton = this.add('done', Ti.UI.createButton({
            top: AD.UI.padding,
            center: {x: AD.UI.screenWidth / 2},
            width: 80,
            height: AD.UI.buttonHeight,
            titleid: 'done'
        }));
        var onSubmit = this.proxy('onSubmit'); // avoid creating two proxies of the same function
        doneButton.addEventListener('click', onSubmit);
        password.addEventListener('return', onSubmit);
        this.add('status', Ti.UI.createLabel({
            left: AD.UI.padding,
            top: AD.UI.padding * 2,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.small,
            text: null
        }));
    },
    
    // Callback to handle password submission
    onSubmit: function() {
        this.status.text = AD.Localize('verifying')+'...';
        var guess = this.getChild('password').value;
        var correct = this.options.password ? (guess === this.options.password) : this.options.verifyCallback(guess);
        this.status.text = AD.Localize(correct ? 'correct' : 'incorrect')+'!';
        if (correct) {
            this.dfd.resolve(guess);
        }
    }
});
