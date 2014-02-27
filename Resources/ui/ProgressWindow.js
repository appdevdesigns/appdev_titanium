var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ProgressWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: this.options.title,
            modal: true,
        });
    },
    
    create: function() {
        var activityIndicator = Ti.UI.createActivityIndicator({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: Ti.UI.SIZE,
            height: Ti.UI.FILL,
            message: this.options.message,
            style: AD.Platform.isiOS ? Titanium.UI.iPhone.ActivityIndicatorStyle.DARK : Titanium.UI.ActivityIndicatorStyle.DARK
        });
        this.add('progress', activityIndicator);
    },
    
    initialize: function() {
        this.getChild('progress').show();
    }
});