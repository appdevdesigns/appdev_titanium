var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ChooseOptionWindow', {
    actions: [{
        title: 'add',
        callback: 'addOption',
        enabled: function() {
            return this.options.editable;
        },
        rightNavButton: true,
        showAsAction: true,
        icon: '/images/ic_action_new.png'
    }, {
        callback: function() {
            // Fill the array with the titles of all the selected rows
            var selected = [];
            this.getRows().forEach(function(row) {
                if (row.hasCheck) {
                    var option = row.option;
                    if (option && this.Model) {
                        // Load the true model from the model cache
                        // Because the option is a property of a Ti.UI.TableViewRow instance, it is
                        // passed through the Titanium proxy and no longer refers to the original model
                        option = this.Model.cache.getById(option.getId());
                    }
                    selected.push(option);
                }
            }, this);

            if (this.options.multiselect) {
                this.dfd.resolve(selected);
            }
            else if (selected.length === 0) {
                // Nothing is selected
                this.dfd.reject();
            }
            else {
                // Use the first (and only) selected option
                this.dfd.resolve(selected[0]);
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
                _this.dfd.resolve(row.option);
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
                var deletedOption = this.options.options.splice(deletedIndex, 1)[0];
                if (this.Model) {
                    // The option is also a model instance, so destroy it
                    deletedOption.destroy();
                }
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
    
    // Display the AddOptionWindow
    addOption: function() {
        var $winAddOption = this.createWindow('ChooseOptionWindow.AddOptionWindow', {
            groupName: this.options.groupName
        });
        var Model = this.Model;
        var addOptionDfd;
        if (Model) {
            addOptionDfd = $.Deferred();
            $winAddOption.getDeferred().done(function(optionLabel) {
                // Create a new model instance to represent this option
                var newOption = new Model();
                newOption.attr(Model.labelKey, optionLabel);
                newOption.save().then(function() {
                    addOptionDfd.resolve(newOption);
                }, addOptionDfd.reject);
            });
        }
        else {
            addOptionDfd = $winAddOption.getDeferred();
        }
        addOptionDfd.done(this.proxy(function(newOption) {
            // Add the new option row to the table and select it
            var newRow = this.createRow(newOption);
            this.getChild('optionsTable').appendRow(newRow);
            this.select(newRow.id);
            
            // This is unnecessary when options are model instances because the model cache is maintained
            if (!this.Model) {
                // Add the option to the options array and notify the caller of the addition
                this.options.options.push(newOption);
                this.onOptionsUpdate();
            }
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
            option: option,
            hasCheck: false
        };
        if (this.Model) {
            row.title = option.attr(this.Model.labelKey);
            row.id = option.getId();
        }
        else {
            row.title = option.title;
            row.id = option.id || this.rowCount;
        }
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
        // If 'init' is called via this._super(...) in a derived class, make sure that the new options are added to this.options
        $.extend(true, this.options, options);
        
        // Initialize the base AD.UI.StringPromptWindow object
        this._super({
            title: $.formatString('addOptionTitle', AD.Localize(this.options.groupName)),
            message: $.formatString('newOptionTitle', AD.Localize(this.options.groupName).toLowerCase()),
            modal: false
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
