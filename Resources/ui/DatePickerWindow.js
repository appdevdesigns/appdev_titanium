var AD = require('AppDev');
var $ = require('jquery');

var DatePickerWindow = module.exports = $.Window('AppDev.UI.DatePickerWindow', {
    actions: [{
        title: 'done',
        callback: 'done',
        rightNavButton: true,
        backButton: true,
        menuItem: false
    }, {
        title: 'cancel',
        callback: 'cancel', // special pre-defined callback to reject the deferred
        leftNavButton: true
    }],
    defaults: {
        minDate: null,
        maxDate: null
    }
}, {
    init: function(options) {
        this.selectedDate = this.options.initialDate || $.today();
        
        // Initialize the base $.Window object
        this._super({
            title: 'datePickerTitle',
            createParams: {
                backgroundColor: 'black'
            },
            autoOpen: true
        });
    },
    
    // Create the datepicker view
    create: function() {
        var datePicker = this.add(Ti.UI.createPicker({
            type: Ti.UI.PICKER_TYPE_DATE,
            minDate: this.options.minDate,
            maxDate: this.options.maxDate,
            value: this.selectedDate,
            selectionIndicator: true
        }));
        var _this = this;
        datePicker.addEventListener('change', function(event) {
            _this.selectedDate = event.value;
        });
    },
    
    done: function() {
        this.dfd.resolve(this.selectedDate);
    }
});
