var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.SortOrderWindow', {
    actions: [{
        callback: function() {
            if (this.modified) {
                // Rebuild the order array
                var rows = this.getChild('fieldsTable').data[0].rows;
                var order = rows.map(function(row) {
                    return row.field;
                });
                this.dfd.resolve(order);
            }
            else {
                // The sort order was not modified, so do nothing
                this.dfd.reject({});
            }
        },
        menuItem: false,
        onClose: true
    }]
}, {
    init: function(options) {
        this.fields = $.indexArray(this.options.fields, 'field');
        this.order = this.options.order;
        this.modified = false;
        
        // Initialize the base $.Window object
        this._super({
            title: 'sortOrderTitle',
            tab: this.options.tab,
            autoOpen: true
        });
    },
    
    // Create the options table view
    create: function() {
        var tableData = [];
        this.order.forEach(function(fieldName) {
            var fieldTitle = this.fields[fieldName].label;
            tableData.push({
                title: AD.Localize(fieldTitle),
                field: fieldName
            });
        }, this);
        
        var fieldsTable = Ti.UI.createTableView({
            moving: true,
            data: tableData
        });
        var _this = this;
        fieldsTable.addEventListener('move', function() {
            // The sort order has been modified
            _this.modified = true;
        });
        this.add('fieldsTable', fieldsTable);
    }
});
