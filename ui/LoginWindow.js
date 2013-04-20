var AD = require('AppDev');
var $ = require('jquery');

var LoginWindow = module.exports = $.Window('AppDev.UI.LoginWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: 'login',
            modal: true,
            focusedChild: 'user'
        });
    },

    // Create the child views
    create: function() {
        // Create the user ID label and text field
        this.add(Ti.UI.createLabel({
            left: AD.UI.padding,
            top: AD.UI.padding,
            width: Ti.UI.SIZE,
            height: Ti.UI.SIZE,
            textid: 'userId'
        }));
        this.add('user', Ti.UI.createTextField({
            left: 110,
            top: AD.UI.padding,
            width: 180,
            height: AD.UI.textFieldHeight,
            hintText: AD.Localize('userId'),
            autocorrect: false,
            autocapitalization: Ti.UI.TEXT_AUTOCAPITALIZATION_NONE,
            borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED
        }));
        
        // Create the password label and text field
        this.add(Ti.UI.createLabel({
            left: AD.UI.padding,
            top: 70,
            width: Ti.UI.SIZE,
            height: Ti.UI.SIZE,
            textid: 'password'
        }));
        var passwordField = this.add('password', Ti.UI.createTextField({
            left: 110,
            top: 70,
            width: 180,
            height: AD.UI.textFieldHeight,
            passwordMask: true,
            hintText: AD.Localize('password'),
            borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED
        }));
        passwordField.addEventListener('return', this.proxy('onSubmit'));
        
        // Create the submit and cancel buttons
        var buttonWidth = AD.UI.useableScreenWidth * 0.4;
        var submit = this.add(Ti.UI.createButton({
            left: AD.UI.padding,
            top: 120,
            width: buttonWidth,
            height: AD.UI.buttonHeight,
            titleid: 'submit'
        }));
        submit.addEventListener('click', this.proxy('onSubmit'));
        var cancel = this.add(Ti.UI.createButton({
            right: AD.UI.padding,
            top: 120,
            width: buttonWidth,
            height: AD.UI.buttonHeight,
            titleid: 'cancel'
        }));
        cancel.addEventListener('click', this.proxy('close'));
        
        // Close the window when it loses focus
        this.window.addEventListener('blur', this.proxy(function(event) {
            // Check that the window itself is losing focus, not just one of its children
            if (event.source === this.window) {
                this.close();
            }
        }));
    },
    
    // Called when the user submits their login credentials
    onSubmit: function() {
        // Gather the login data
        var loginData = {
            userID: this.getChild('user').value,
            pWord: Ti.Utils.md5HexDigest(this.getChild('password').value) // MD5 hash the user's password
        };
        
        // Send login request to the server
        Ti.API.log('Attempting to login as {'+loginData.userID+', '+loginData.pWord+'}');
        AD.ServiceJSON.post({
            params: loginData,
            url: '/service/site/login/authenticate',
            success: this.proxy(function(data) {
                Ti.API.log('Login succeeded!');
                
                this.close();
                
                // Call the onLogin callback if it was provided to the "open" call
                if ($.isFunction(this.onLogin)) {
                    this.onLogin();
                }
            }),
            failure: function(data) {
                Ti.API.log('Login failed!');
            }
        });
    },
    
    // Override the default window open function
    open: function(onLogin) {
        this.onLogin = onLogin;
        
        // Clear out the input fields
        this.getChild('user').value = '';
        this.getChild('password').value = '';
        return this._super.apply(this, arguments);
    }
});
