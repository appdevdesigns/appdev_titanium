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
        value: false
    }
}, {
    init: function(options) {
        this.value = this.options.value;
        
        // Create the checkbox image
        var checkbox = Ti.UI.createImageView(this.options.createParams);
        
        // The image is the checkbox's view
        this._super({view: checkbox});
        
        this.addEventListener('click', function(event) {
            // Toggle the checkbox state
            this.setValue(!this.value);
            // Emmulate a change event
            checkbox.fireEvent('change', {
                source: event.source,
                type: 'change',
                value: this.value
            });
        });
        
        this.update();
    },
    
    update: function() {
        var checkbox = this.view;
        checkbox.image = this.value ? '/images/checkbox-checked.png' : '/images/checkbox-unchecked.png';
    },
    
    setValue: function(value) {
        this.value = value;
        this.update();
    }
});
