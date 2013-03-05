var AD = require('AppDev');
var $ = require('jquery');

function LoginWindow() {
    var _this = this;
    var loginWindow = null;
    var onLogin = null;
    var open = false;
    
    // Create the login window and all its components
    var create = function() {
        var onSubmit = function() {
            // Gather the login data
            var loginData = {
                userID: userID.value,
                pWord: Ti.Utils.md5HexDigest(pWord.value) // MD5 hash the user's password
            };
            
            // Send login request to the server
            Ti.API.log('Attempting to login as {'+loginData.userID+', '+loginData.pWord+'}');
            AD.ServiceJSON.post({
                params: loginData,
                url: '/service/site/login/authenticate',
                success: function(data) {
                    Ti.API.log('Login succeeded!');
                    
                    // Close the loginWindow
                    _this.close();
                    
                    // Call the onLogin callback if it was provided to the "open" call
                    if ($.isFunction(onLogin)) {
                        onLogin();
                    }
                },
                failure: function(data) {
                    Ti.API.log('error failed!');
                    Ti.API.log(error);
                }
            });
        };
        
        loginWindow = Ti.UI.createWindow({
            titleid: 'login',
            backgroundColor: '#fff'
        });
        
        // Create the user ID label and text field
        var userIDLabel = Ti.UI.createLabel({
            textid: 'userID',
            top: 20,
            left: 20,
            width: 80,
            height: 40
        });
        loginWindow.add(userIDLabel);
        var userID = Ti.UI.createTextField({
            top: 20,
            left: 110,
            width: 180,
            height: AD.UI.textFieldHeight,
            hintText: L('userID'),
            autocorrect: false,
            autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE,
            borderStyle: Titanium.UI.INPUT_BORDERSTYLE_ROUNDED,
            clear: true // Custom property
        });
        loginWindow.add(userID);
        
        // Create the password label and text field
        var pWordLabel = Ti.UI.createLabel({
            textid: 'pWord',
            top: 70,
            left: 20,
            width: 80,
            height: 40
        });
        loginWindow.add(pWordLabel);
        var pWord = Ti.UI.createTextField({
            top: 70,
            left: 110,
            width: 180,
            height: AD.UI.textFieldHeight,
            passwordMask: true,
            hintText: L('pWord'),
            borderStyle: Titanium.UI.INPUT_BORDERSTYLE_ROUNDED,
            clear: true // Custom property
        });
        pWord.addEventListener('return', onSubmit);
        loginWindow.add(pWord);
        
        // Create the submit button
        var submit = Ti.UI.createButton({
            titleid: 'submit',
            top: 120,
            left: 20,
            width: 100,
            height: 40
        });
        submit.addEventListener('click', onSubmit);
        loginWindow.add(submit);
        
        // Create the cancel button
        var cancel = Ti.UI.createButton({
            titleid: 'cancel',
            top: 120,
            left: 140,
            width: 100,
            height: 40
        });
        cancel.addEventListener('click', function() {
            // Close the loginWindow
            _this.close();
        });
        loginWindow.add(cancel);
        
        // When the window opens, focus the user ID text field
        loginWindow.addEventListener('open', function() {
            userID.focus();
        });
    };
    
    // Open the login window and call onLoginCallback after a successful login
    this.open = function(onLoginCallback) {
        onLogin = onLoginCallback;
        
        // Clear the values of all the elements created with the custom "clear" property
        loginWindow.children.forEach(function(child) {
            if (child.clear) {
                child.value = "";
            }
        });
        
        loginWindow.open({modal: true});
        open = true;
    };
    
    // Close the login window
    this.close = function() {
        loginWindow.close();
        open = false;
    };
    
    // Return a boolean indicating whether the login window is open
    this.isOpen = function() {
        return open;
    };
    
    create();
}
module.exports = LoginWindow;
