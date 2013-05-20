var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ChooseOptionWindow', {
    actions: [{
        title: 'add',
        callback: 'addOption',
        enabled: function() {
            return this.options.editable;
        },
        rightNavButton: true
    }, {
        callback: function() {
            if (this.dfd.state() === 'pending') {
                // "Select" the currently selected option only if the window was not closing in response to the selection of an option
                this.onSelect(this.selected);
            }
        },
        menuItem: false,
        onClose: true
    }],
    
    // Convert a multivalue object used to store contact information and convert it to an array of options useable by ChooseOptionWindow
    multivalueToOptionsArray: function(multivalue) {
        var options = [];
        $.each(multivalue, function(label, values) {
            for (var i = 0; i < values.length; ++i) {
                options.push({
                    label: label + (i === 0 ? '' : i+1),
                    value: values[i],
                    id: label+':'+i
                });
            }
        });
        return options;
    }
}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: $.formatString('chooseOptionTitle', AD.Localize(this.options.groupName).toLowerCase()),
            autoOpen: true
        });
    },
    
    // Create the options table view
    create: function() {
        // Create rows for each of the options
        var tableData = this.options.options.map(this.createRow, this);
        
        // Create the options table
        var _this = this;
        var optionsTable = Ti.UI.createTableView({
            data: tableData
        });
        optionsTable.addEventListener('click', function(event) {
            // An option row was clicked
            _this.onSelect(event.index);
        });
        this.add('optionsTable', optionsTable);
        
        if (this.options.editable) {
            optionsTable.editable = true;
            optionsTable.addEventListener('delete', this.proxy(function(event) {
                var deletedIndex = event.rowData.index;
                if (this.selected === deletedIndex) {
                    // The selected option was deleted
                    this.selected = -1;
                }
                
                // Re-index the rows to maintain the integrity of their indices
                this.getRows().forEach(function(row, index) {
                    row.index = index;
                });
                --this.rowCount;
                
                // Remove the option from the options array and notify the caller of the removal
                this.options.options.splice(deletedIndex, 1);
                this.onOptionsUpdate();
            }));
        }
    },
    
    // The index of the selected row, or -1 if no row is selected
    // Will be set initially when creating a row through createRow whose id matches the specified initial row
    selected: -1,
    // Called when a row is selected
    onSelect: function(index) {
        var row = this.getRows()[index];
        if (row) {
            this.dfd.resolve(row.item);
        }
        else {
            // Nothing has been selected, or the previously selected option has been deleted
            this.dfd.reject();
        }
    },
    
    // Display the AddOptionWindow
    addOption: function() {
        var $winAddOption = new AddOptionWindow({
            tab: this.tab,
            groupName: this.options.groupName
        });
        $winAddOption.getDeferred().done(this.proxy(function(newOption) {
            // Unselect the other options
            this.getRows().forEach(function(row) {
                row.hasCheck = false;
            });
            
            // Select the new option and add it to the table
            var newRow = this.createRow(newOption);
            this.selected = newRow.index;
            newRow.hasCheck = true;
            this.getChild('optionsTable').appendRow(newRow);
            
            // Add the option to the options array and notify the caller of the addition
            this.options.options.push(newOption);
            this.onOptionsUpdate();
        }));
    },
    
    // Alert the caller to the modification of the options list
    onOptionsUpdate: function() {
        if ($.isFunction(this.options.onOptionsUpdate)) {
            this.options.onOptionsUpdate(this.options.options);
        }
    },
    
    rowCount: 0,
    // Return a row data structure representing the option
    createRow: function(option) {
        var row = {};
        if (typeof option === 'string') {
            row = {
                title: option,
                item: { label: option, value: option },
                id: this.rowCount
            };
        }
        else if (typeof option === 'object') {
            row = {
                title: option.label+': '+option.value,
                item: option,
                id: option.id
            };
        }
        row.index = row.item.index = this.rowCount++;
        if (row.id === this.options.initial) {
            // This is the initially selected row
            this.selected = row.index;
            row.hasCheck = true;
        }
        return Ti.UI.createTableViewRow(row);
    },

    // Return an array of the rows in the table
    getRows: function() {
        var section = this.getChild('optionsTable').data[0];
        return section ? (section.rows || []) : [];
    }
});

// This window allows the user to add a new option
require('ui/StringPromptWindow');
var AddOptionWindow = AD.UI.StringPromptWindow('AppDev.UI.ChooseOptionWindow.AddOptionWindow', {}, {
    init: function(options) {
        // Initialize the base AD.UI.StringPromptWindow object
        this._super({
            title: $.formatString('addOptionTitle', AD.Localize(this.options.groupName)),
            message: $.formatString('newOptionTitle', AD.Localize(this.options.groupName).toLowerCase())
        });
    }
});
