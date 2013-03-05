var $ = require('jquery');

var DatePickerWindow = module.exports = $.Window('AppDev.UI.DatePickerWindow', {
    actions: [{
        title: 'done',
        callback: function() {
            this.dfd.resolve(this.selectedDate);
        },
        rightNavButton: true,
        backButton: true
    }, {
        title: 'cancel',
        callback: 'cancel', // special pre-defined callback to reject the deferred
        leftNavButton: true,
        backButton: true
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
        var datePicker = Ti.UI.createPicker({
            type: Ti.UI.PICKER_TYPE_DATE,
            minDate: this.options.minDate,
            maxDate: this.options.maxDate,
            value: this.selectedDate,
            selectionIndicator: true
        });
        datePicker.addEventListener('change', this.proxy(function(event) {
            this.selectedDate = event.value;
        }));
        this.add(datePicker);
    }
});

// Quick function to display the date picker window in a single function call
// Return a deferred that will resolve to the chosen date
DatePickerWindow.datePicker = function(options) {
    var $winDatePicker = new DatePickerWindow(options);
    return $winDatePicker.getDeferred();
};
