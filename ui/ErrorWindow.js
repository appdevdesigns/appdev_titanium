var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ErrorWindow', {
    defaults: {
        error: {
            description: 'Unknown error',
            technical: 'Unknown error occurred'
        }
    }
}, {
    init: function(options) {
        this.error = this.options.error;
        
        // Initialize the base $.Window object
        this._super({
            createParams: {
                layout: 'vertical',
                fullscreen: true
            },
            title: 'startupErrorTitle',
            autoOpen: true
        });
    },
    
    // Create child views
    create: function() {
        this.add('description', Ti.UI.createLabel({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.header,
            textAlign: 'center'
        }));
        this.add('info', Ti.UI.createLabel({
            top: AD.UI.padding * 2,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.mediumSmall
        }));
        
        var retryCallback = this.options.retry;
        if (retryCallback) {
            // If a retry callback is specified, create a retry button that will call retryCallback when pressed 
            var retryButton = this.add('retry', Ti.UI.createButton({
                top: AD.UI.padding * 4,
                center: { x: AD.UI.screenWidth / 2 }, // horizontally centered
                width: 120,
                height: AD.UI.buttonHeight,
                titleid: 'retry'
            }));
            var _this = this;
            retryButton.addEventListener('click', function(event) {
                retryCallback();
                _this.dfd.reject();
            });
        }
    },
    
    // Initialize the child views
    initialize: function() {
        this.getChild('description').text = this.error.description;
        this.getChild('info').text = this.error.technical + (this.error.fix ? '\n\n'+this.error.fix+'\n' : '');
    }
});
