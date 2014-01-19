var AD = require('AppDev');
var $ = require('jquery');

var DatePickerWindow = module.exports = $.Window('AppDev.UI.DatePickerWindow', {
    actions: [{
        callback: function() {
            this.dfd.resolve(this.selectedDate);
        },
        menuItem: false,
        onClose: true
    }, {
        title: 'cancel',
        callback: 'cancel', // special pre-defined callback to reject the deferred
        rightNavButton: true
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
    }
});
