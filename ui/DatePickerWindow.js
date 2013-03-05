var AD = require('AppDev');
var $ = require('jquery');

var DatePickerWindow = module.exports = $.Window('AppDev.UI.DatePickerWindow', {
    actions: [{
        title: 'done',
        callback: 'done',
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
    },
    
    // Quick function to display the date picker window in a single function call
    // Return a deferred that will resolve to the chosen date
    datePicker: function(options) {
        var $winDatePicker = new DatePickerWindow(options);
        return $winDatePicker.getDeferred();
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
        datePicker.addEventListener('change', this.proxy(function(event) {
            this.selectedDate = event.value;
        }));
        if (AD.Platform.isAndroid) {
            // Create a done button on Android
            var doneButton = this.add(Ti.UI.createButton({
                bottom: AD.UI.padding * 2,
                center: { x: AD.UI.screenWidth / 2 },
                width: 120,
                height: AD.UI.buttonHeight,
                titleid: 'done'
            }));
            doneButton.addEventListener('click', this.proxy('done'));
        }
    },
    
    done: function() {
        this.dfd.resolve(this.selectedDate);
    }
});
