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
            autoOpen: true
        });
    },
    
    // Create the options table view
    create: function() {
        var tableData = this.order.map(function(fieldName) {
            var fieldTitle = this.fields[fieldName].label;
            return {
                title: AD.Localize(fieldTitle),
                field: fieldName
            };
        }, this);
        
        var _this = this;
        if (!AD.Platform.isiOS) {
            var swapRows = function(index1, index2) {
                var rows = fieldsTable.data[0].rows;
                var row1 = rows[index1];
                var row2 = rows[index2];
                if (!row1 || !row2) {
                    // Not a valid row (probably out of bounds), so abort
                    return;
                }
        
                // Swap the location of the rows in the array
                rows[index1] = row2;
                rows[index2] = row1;
        
                // Swap the rows' indexes
                row1.index = index2;
                row2.index = index1;
                rows.forEach(function(row, index) {
                    row.index = index;
                });
        
                // Update the table with the new rows
                fieldsTable.setData(rows);
                
                // The sort order has been modified
                _this.modified = true;
            };
            
            tableData = tableData.map(function(data, index) {
                var row = Ti.UI.createTableViewRow({
                    height: Ti.UI.SIZE,
                    field: data.field,
                    index: index
                });
                row.add(Ti.UI.createLabel({
                    left: AD.UI.padding,
                    top: 0,
                    width: Ti.UI.SIZE,
                    height: Ti.UI.SIZE,
                    text: data.title,
                    font: AD.UI.Fonts.header
                }));
                var moveContainer = Ti.UI.createView({
                    right: 0,
                    top: AD.UI.padding,
                    bottom: AD.UI.padding,
                    width: Ti.UI.SIZE,
                    height: Ti.UI.SIZE,
                    layout: 'horizontal'
                });
                row.add(moveContainer);
                
                var moveDown = Ti.UI.createImageView({
                    right: AD.UI.padding * 3,
                    image: '/images/arrow-down.png'
                });
                moveDown.addEventListener('click', function(event) {
                    var index = row.index;
                    swapRows(index, index + 1);
                });
                moveContainer.add(moveDown);
                
                var moveUp = Ti.UI.createImageView({
                    right: AD.UI.padding * 3,
                    image: '/images/arrow-up.png'
                });
                moveUp.addEventListener('click', function(event) {
                    var index = row.index;
                    swapRows(index, index - 1);
                });
                moveContainer.add(moveUp);
                
                return row;
            });
        }
        
        var fieldsTable = Ti.UI.createTableView({
            data: tableData
        });
        this.add('fieldsTable', fieldsTable);
        
        if (AD.Platform.isiOS) {
            // iOS supports moveable table rows natively
            fieldsTable.moving = true;
            fieldsTable.addEventListener('move', function() {
                // The sort order has been modified
                _this.modified = true;
            });
        }
    }
});
