var AD = require('AppDev');
var $ = require('jquery');

var defaultSize = AD.UI.buttonHeight;

// This class extends $.View and represents a custom checkbox control.
module.exports = $.View('AppDev.UI.Checkbox', {
    defaultSize: defaultSize,
    defaults: {
        createParams: {
            width: defaultSize,
            height: defaultSize
        },
        overlayText: null,
        value: false
    }
}, {
    init: function(options) {
        this.value = this.options.value;
        
        var view = Ti.UI.createView(this.options.createParams);
        
        // The image is the checkbox's view
        this._super({ view: view });
        
        this.addEventListener('click', function(event) {
            // Toggle the checkbox state
            this.setValue(!this.value);
            // Emmulate a change event
            view.fireEvent('change', {
                source: event.source,
                type: 'change',
                value: this.value
            });
        });
    },

    // Create the child views
    create: function() {
        // Create the checkbox image
        this.add('checkbox', Ti.UI.createImageView({
            width: Ti.UI.FILL,
            height: Ti.UI.FILL
        }));
        // Create the overlay text label
        this.add('overlay', Ti.UI.createLabel({
            width: Ti.UI.FILL,
            height: Ti.UI.FILL,
            textAlign: 'center',
            font: AD.UI.Fonts.small,
            text: this.options.overlayText
        }));
    },

    // Initialize the child views
    initialize: function() {
        this.update();
    },
    
    update: function() {
        this.getChild('checkbox').image = this.value ? '/images/checkbox-checked.png' : '/images/checkbox-unchecked.png';
    },
    
    setValue: function(value) {
        this.value = value;
        this.update();
    }
});
