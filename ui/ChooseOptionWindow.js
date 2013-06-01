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
                // Fill the array with the titles of all the selected rows
                var selected = [];
                this.getRows().forEach(function(row) {
                    if (row.hasCheck) {
                        selected.push(row.option);
                    }
                });

                if (this.options.multiselect) {
                    this.dfd.resolve(selected);
                }
                else {
                    // Use the first (and only) selected option
                    this.resolve(selected[0]);
                }
            }
        },
        menuItem: false,
        onClose: true
    }],
    
    defaults: {
        multiselect: false,
        initial: null
    },

    // Convert a multivalue object used to store contact information and convert it to an array of options useable by ChooseOptionWindow
    multivalueToOptionsArray: function(multivalue) {
        var options = [];
        $.each(multivalue, function(label, values) {
            values.forEach(function(value, index) {
                options.push({
                    title: label + (index === 0 ? '' : ' '+(index+1)) + ': ' + value,
                    value: value,
                    id: label+':'+index
                });
            });
        });
        return options;
    }
}, {
    init: function(options) {
        // If 'init' is called via this._super(...) in a derived class, make sure that the new options are added to this.options
        $.extend(true, this.options, options);

        this.Model = this.options.Model;
        if (typeof this.Model === 'string') {
            // "Model" can also be a string representing the name of the model class
            this.Model = AD.Models[this.Model];
        }
        if (this.Model && this.Model.cache && !this.options.options) {
            // Automatically generate the options from the model instance cache
            this.options.options = this.Model.cache.getArray();
        }

        // Initialize the base $.Window object
        this._super({
            title: $.formatString('chooseOptionTitle', AD.Localize(this.options.groupName+(this.options.multiselect ? 's' : '')).toLowerCase()),
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
            var row = _this.select(event.row.id);
            if (!_this.options.multiselect) {
                _this.resolve(row.option);
            }
        });
        this.add('optionsTable', optionsTable);
        
        if (this.options.multiselect) {
            // Select all initially selected options
            this.options.initial.forEach(this.select, this);
        }
        else {
            // Select the initially selected option
            this.select(this.options.initial);
        }

        if (this.options.editable) {
            optionsTable.editable = true;
            optionsTable.addEventListener('delete', this.proxy(function(event) {
                // Re-index the rows to maintain the integrity of their indices
                this.getRows().forEach(function(row, index) {
                    row.index = index;
                });
                --this.rowCount;
                
                // Remove the option from the options array and notify the caller of the removal
                var deletedIndex = event.rowData.index;
                this.options.options.splice(deletedIndex, 1);
                this.onOptionsUpdate();
            }));
        }
    },
    
    // Select the row with the given id
    select: function(id) {
        var rows = this.getRows();
        var row = null;
        // Find the row with the specified id
        $.each(rows, function(index, currentRow) {
            if (currentRow.id === id) {
                row = currentRow;
                return false; // stop iterating
            }
        });
        if (row) {
            if (!this.options.multiselect) {
                // Unselect the other rows
                rows.forEach(function(row) {
                    row.hasCheck = false;
                });
            }
            // Toggle the selection state of the row
            row.hasCheck = !row.hasCheck;
        }
        return row;
    },

    // Complete the "choose option" operation with the specified option
    resolve: function(option) {
        if (option) {
            this.dfd.resolve(option);
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
            // Add the new option row to the table and select it
            var newRow = this.createRow(newOption);
            this.getChild('optionsTable').appendRow(newRow);
            this.select(newRow.id);
            
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
        if (typeof option === 'string') {
            // Convert simple string options to full option objects
            option = {
                title: option,
                value: option,
                id: option
            };
        }
        var row = {
            title: option.title,
            option: option,
            id: option.id || this.rowCount,
            hasCheck: false
        };
        row.index = option.index = this.rowCount++;
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

// Create a specialized ChooseOptionsWindow class that allows multiple options to be selected
// This functionality is present in ChooseOptionWindow, but
// ChooseOptionsWindow simply enables multiselect by default.
AD.UI.ChooseOptionWindow('AppDev.UI.ChooseOptionsWindow', {
    defaults: {
        multiselect: true,
        initial: []
    }
}, {});
