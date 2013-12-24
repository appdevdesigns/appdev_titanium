var AD = require('AppDev');
var $ = require('jquery');
var GoogleAPIs = require('appdev/GoogleAPIs');

module.exports = $.Window('AppDev.UI.GoogleAuthWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: 'login',
            autoOpen: true
        });
    },

    // Create the child views
    create: function() {
        var _this = this;

        // Create the WebView that will authenticate the user with Google
        var webview = this.add('webview', Ti.UI.createWebView({
            url: AD.Comm.HTTP.makeURL('https://accounts.google.com/o/oauth2/auth', {
                response_type: 'code',
                client_id: GoogleAPIs.client_id,
                redirect_uri: GoogleAPIs.redirect_uri,
                scope: this.options.scope
            })
        }));
        webview.addEventListener('load', function() {
            var approvalPageURL = 'https://accounts.google.com/o/oauth2/approval';
            if (webview.evalJS('location.origin+location.pathname') === approvalPageURL) {
                // This is the approval page, so read the authorization code
                var code = webview.evalJS("document.getElementById('code').value");
                console.log('code: '+code);
                _this.getDeferred().resolve(code);
            }
        });
    }
});
