var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ActivityWindow', {
    defaults: {
        max: null
    }
}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: this.options.title,
            modal: true
        });
    },
    
    // Create the child views
    create: function() {
        var activityIndicator = Ti.UI.createActivityIndicator({
            width: Ti.UI.FILL,
            height: Ti.UI.FILL,
            messageid: this.options.message,
            style: AD.Platform.isiOS ? Titanium.UI.iPhone.ActivityIndicatorStyle.DARK : Titanium.UI.ActivityIndicatorStyle.DARK
        });
        this.add('activityIndicator', activityIndicator);
        
        var progressBar = Ti.UI.createProgressBar({
            left: AD.UI.padding,
            right: AD.UI.padding,
            height: Ti.UI.FILL,
            min: 0
        });
        this.add('progressBar', progressBar);
    },
    
    // Update the activity status
    // If "current" is null, the window represents an activity of indeterminate duration
    // Otherwise, the window represents an activity of determinate duration with "current" of "total" subtasks completed
    setProgress: function(current, total) {
        var activityIndicator = this.getChild('activityIndicator');
        var progressBar = this.getChild('progressBar');
        if (current === null) {
            // The activity is of indeterminate length, so show the activity indicator
            activityIndicator.visible = true;
            progressBar.visible = false;
        }
        else {
            // The activity is of determinate length, so show and update the progress bar
            activityIndicator.visible = false;
            progressBar.visible = true;
            progressBar.max = total;
            progressBar.value = current;
            progressBar.message = $.formatString('{0} ({1}%)', AD.Localize(this.options.message), (current / total * 100).toFixed(0));
        }
    }
});
