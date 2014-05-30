var $ = require('jquery');
var AD = require('AppDev');

/**
 * This class represents a generic table view associated with a list of models
 * Table rows can be customized, selected, added, and removed
 * 
 * The following static properties may be specified by derived classes:
 *     rowClassName:  The OPTIONAL unique class name of the table view rows (defaults to the name of the derived ModelTable class)
 * 
 * The following prototype properties should be specified by derived classes:
 *     createRow:     The function that will be used to create the rows
 *     compare:       The OPTIONAL model comparision function that is used to sort rows if the sort option is set to true (defaults to sorting by primaryKey)
 *     filter:        The OPTIONAL function that will used to determine whether models are displayed in the table
 *     onSelect:      The OPTIONAL callback function that will be called when a model row is selected
 * 
 * The following options are allowed for the constructor parameters: (all are optional unless specified otherwise)
 *     $window:       The $.Window instance that this table is a child of; helpful for retaining access to the parent window in callbacks
 *     Model:         The REQUIRED model class associated with this table
 *     selectable:    Set to true to enable selection of model rows
 *     editable:      Set to true to enable rows to be edited (deleted) in iOS
 *     grouped:       Set to true to group the models according to the sortOrder
 *     sorted:        Set to true to sort the models according on the compareModels function
 * 
 * To filter the models that are displayed, implement the 'filter' prototype method.  It should return true
 * for all models that should be displayed in the table and false for all models that should not be displayed.
 */
$.View('jQuery.ModelTable', {
    // Functions to determine the group name of a model
    groupProcessors: {},
    addGroupProcessor: function(name, callback) {
        this.groupProcessors[name] = callback;
    },
    init: function() {
        if (this.sortFields) {
            this.indexedSortFields = $.indexArray(this.sortFields, 'field');
        }
    },
    refreshDelay: 0
}, {
    init: function(options) {
        // If 'init' is called via this._super(...) in a derived class, make sure that the new options are added to this.options
        $.extend(true, this.options, options);
        
        if ($.isFunction(this.options.onSelect) && !$.isFunction(this.onSelect)) {
            this.onSelect = this.options.onSelect;
        }
        
        // Create the table view
        this.table = Ti.UI.createTableView();
        if ($.isFunction(this.onSelect)) {
            this.table.addEventListener('click', this.proxy(function(event) {
                // A model was selected, so call the callback
                var model = this.lookupModel(event.row.modelId);
                this.onSelect(model);
            }));
        }
        else {
            this.table.allowsSelection = false;
        }
        this.table.addEventListener('delete', this.proxy(function(event) {
             // This row will be removed by the system and does not need to be removed by custom code
            event.row.deleted = true;
            
            // Delete the associated model from the database
            var model = this.lookupModel(event.row.modelId);
            model.destroy();
        }));
        
        // Keep track of the table's rows manually because there appear to be timing issues when accessing
        // this.table.data[0].rows when deleting a row and adding it back again in the correct position
        this.rows = [];
        
        // Dictionary of table view rows, indexed by their model id
        this.modelRows = {};
        
        if (this.options.editable) {
            // Allow rows to be edited (deleted)
            this.table.editable = true;
        }
        
        // The table is the view's view
        this._super({view: this.table});
        
        this.$window = this.options.$window;
        
        this.smartBind(this.options.Model, '*', function(event, model) {
            var row = this.rowFromModel(model);
            if (event.type === 'destroyed' && row && row.deleted) {
                // Remove the deleted model from the table
                this.removeRow(row, true);
                this.update();
            }
            else {
                // Otherwise, refresh the table
                this.refresh();
            }
        });
        
        // Create the table view rows; setSortOrder will call refresh
        this.setSortOrder(this.options.sortOrder);
        
        // Use $.throttle to batch expensive UI updates
        this.refresh = $.throttle(this.refresh, this.constructor.refreshDelay);
    },
    
    // Recreate all the rows in the table
    refresh: function() {
        this.rows = [];
        this.options.Model.cache.getArray().forEach(function(model) {
            this.addModel(model, false);
        }, this);
        
        var tableData = null;
        if (this.options.grouped) {
            // Break the groups into sections
            tableData = AD.UI.rowsToSections(this.rows, this.proxy('rowToGroupKey'));
        }
        else {
            tableData = this.rows;
        }
        
        this.table.setData(tableData);
        
        this.update();
    },
    
    // Perform custom update operations
    update: function() {
        // By default, this callback does nothing, but it can be overridden in derived classes
    },
    
    // Set the sorting order and resort the rows
    setSortOrder: function(sortOrder) {
        if (sortOrder) {
            this.sortOrder = sortOrder;
            this.primarySortField = this.constructor.indexedSortFields[sortOrder[0]];
            this.groupProcessor = this.constructor.groupProcessors[this.primarySortField.groupProcessor];
        }
        this.refresh();
    },
    
    // Return the number of rows/models in the table
    countRows: function() {
        return this.rows.length;
    },
    
    // Create and return a new row representing the model (should be overridden by the derived class) 
    createRow: function(model) {
        return Ti.UI.createTableViewRow({});
    },
    
    // Create the model's table view row
    addModel: function(model, insertRow) {
        // First attempt to use the existing row for this model
        var modelId = model.getId();
        var tableRow = this.modelRows[modelId];
        if (!tableRow) {
            // The row does not exist, so create a new one
            tableRow = this.createRow(model);
            tableRow.modelId = modelId; // custom property
            tableRow.hasChild = this.options.selectable;
            tableRow.className = this.rowClassName || this.constructor.fullName; // unique row class name that defaults to the name of the derived class
            
            // Now save it
            this.modelRows[modelId] = tableRow;
        }
        
        var matchedFilter = this.filter(model);
        if (matchedFilter) {
            this.addRow(tableRow, insertRow);
        }
    },
    
    // Return the row associated with a model
    rowFromModel: function(model) {
        var foundRow = null;
        var _this = this;
        this.rows.forEach(function(row) {
            if (row.modelId === model.getId()) {
                foundRow = row;
            }
        });
        return foundRow;
    },
    
    // Low-level routine to add the row into the model table in the correct place
    // If insertRow is true the actual table is modified, not just the this.row array
    addRow: function(newRow, insertRow) {
        // Determine where to insert the row by setting rowIndex to the first row that should come after it
        // The new row will take the place of that row, shifting it and the rows after it down
        var rowIndex = null;
        this.rows.forEach(function(row, index) {
            if (rowIndex === null && this.compareModels(newRow.modelId, row.modelId) < 0) {
                // Insert the row before this row
                rowIndex = index;
            }
        }, this);
        if (rowIndex === null) {
            rowIndex = this.rows.length;
            if (insertRow) {
                this.table.appendRow(newRow);
            }
        }
        else {
            if (insertRow) {
                this.table.insertRowBefore(rowIndex, newRow);
            }
        }
        this.rows.splice(rowIndex, 0, newRow); // add the row to the rows array
        newRow.index = rowIndex;
        this.updateIndices();
    },
    // Low-level routine to remove the row from the model table
    // If deleteRow is true the actual table is modified, not just the this.row array
    removeRow: function(row, deleteRow) {
        var index = row.index;
        this.rows.splice(index, 1);
        row.index = null;
        this.updateIndices();
        
        // If the custom 'deleted' property is set, it means that the row was deleted by the system as a
        // result of clicking the 'delete' button and it should not be removed from the table view manually
        if (!row.deleted && deleteRow) {
            this.table.deleteRow(index);
        }
    },
    // Update the index property of each row to match its position in the list
    updateIndices: function() {
        this.rows.forEach(function(child, index) {
            // The index of each row should be set to its index in the array
            child.index = index;
        });
    },
    
    // Return the difference between modelId1 and modelId2
    compareModels: function(modelId1, modelId2) {
        if (this.options.sorted) {
            return this.compare(this.lookupModel(modelId1), this.lookupModel(modelId2));
        }
        else {
            // Compare the models by id
            return modelId1 - modelId2;
        }
    },
    
    // Return a model based on its primary key (shortcut for this.options.Model.cache.getById)
    lookupModel: function(modelId) {
        return this.options.Model.cache.getById(modelId);
    },
    
    // Return the group key associated with a row
    rowToGroupKey: function(row) {
        var model = this.lookupModel(row.modelId);
        var key = model.attr(this.primarySortField.field);
        if (this.groupProcessor) {
            key = this.groupProcessor(key);
        }
        return key;
    },
    
    // Default model comparison compares models according to the defined sort order
    // Return 1 if model1 should come after model2 or -1 if model1 should come before model2
    compare: function(model1, model2) {
        // Compare model1 and model2 one field at a time until they do not match
        var difference = 0;
        this.sortOrder.forEach(function(sortField) {
            if (difference === 0) {
                var key1 = model1.attr(sortField);
                var key2 = model2.attr(sortField);
                if (typeof key1 === 'string' && typeof key2 === 'string') {
                    // For strings, do a case-insensitive comparison
                    key1 = key1.toUpperCase();
                    key2 = key2.toUpperCase();
                }
                difference = $.compare(key1, key2);
            }
        });
        return difference;
    },
    
    // All models pass the default model filter
    filter: function(model) {
        return true;
    }
});
