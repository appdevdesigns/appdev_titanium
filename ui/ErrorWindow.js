var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AD.UI.ErrorWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            createParams: {
                layout: 'vertical'
            },
            title: L('startupErrorTitle')
        });
        this.setError(this.options.error);
    },
    
    // Create child views
    create: function() {
        this.add('description', Ti.UI.createLabel({
            top: 10,
            left: 10,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.header,
            textAlign: 'center'
        }));
        this.add('info', Ti.UI.createLabel({
            top: 20,
            left: 10,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.mediumSmall
        }));
        
        var retryCallback = this.options.retry;
        if (retryCallback) {
            // If a retry callback is specified, create a retry button that will call retryCallback when pressed 
            var retryButton = this.add('retry', Ti.UI.createButton({
                top: 40,
                center: {
                    x: AD.UI.screenWidth / 2
                },
                width: 120,
                height: AD.UI.buttonHeight,
                titleid: 'retry'
            }));
            retryButton.addEventListener('click', function(event) {
                retryCallback();
            });
        }
    },
    
    // Update the error message
    setError: function(error) {
        // Default to a generic error message
        this.error = error || {
            description: 'Unknown error',
            technical: 'Unknown error occurred'
        };
        this.getChild('description').text = this.error.description;
        this.getChild('info').text = this.error.technical + (this.error.fix ? '\n\n'+this.error.fix+'\n' : '');
    }
});