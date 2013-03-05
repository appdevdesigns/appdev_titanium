var $ = require('jquery');
var AD = require('AppDev');

// Create a model subclass that represents a locally stored database that other models can derive from
module.exports = $.Class('AD.DataStore.SQLite', {
    create: function(dataMgr, callback) {
        var _this = this;
        var columns = [];
        var values = [];
        $.each(dataMgr.model, function(key, value) {
            columns.push(key);
            values.push(value);
        });
        var query = 'INSERT INTO '+dataMgr.dbTable+' ('+ columns.join(', ') + ') VALUES ('+ $.createArray(columns.length, '?').join(', ') + ')';
        return this.execute(dataMgr.dbName, query, values, callback);
    },
    
    update: function(dataMgr, callback) {
        var conditions = [];
        var values = [];
        $.each(dataMgr.model, function(key, value) {
            conditions.push(key+"=?");
            values.push(value);
        });
        values.push(dataMgr.id);
        var query = 'UPDATE '+dataMgr.dbTable+' SET '+conditions.join(', ')+' WHERE '+dataMgr.primaryKey+'=?';
        return this.execute(dataMgr.dbName, query, values, callback);
    },
    
    destroy: function(dataMgr, callback) {
        var conditions = [];
        var values = [];
        $.each(dataMgr.model, function(key, value) {
            conditions.push(key+"=?");
            values.push(value);
        });
        var condition = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
        var query = 'DELETE FROM '+dataMgr.dbTable+condition;
        return this.execute(dataMgr.dbName, query, values, callback);
    },
    
    read: function(dataMgr, callback) {
        // Which fields to retrieve?
        var select = '*';
        if (!dataMgr.selectedFields._empty) {
            delete dataMgr.selectedFields._empty;
            var selectFields = [];
            for (var key in dataMgr.selectedFields) {
                // These fields all have a tref prepended
                selectFields.push(dataMgr.selectedFields[key].tref+'.'+key);
            }
            select = selectFields.join(', ');
        }
        
        var conditions = [];
        var values = [];
        
        // Any JOINs required?
        var tableName = dataMgr.dbTable;
        if (dataMgr.joinedTables.length > 0) {
            tableName += ' AS p';
            tableName += this.getJoinedTables(dataMgr.joinedTables, 'p', values);
        }
        
        if (dataMgr.cond) {
            conditions.push(dataMgr.cond);
        }
        
        // Build up the condition (WHERE) from the model
        $.each(dataMgr.model, function(fieldName, value) {
            if ((typeof dataMgr.model[fieldName] === 'object') && (value !== null)) {
                // More work needed
                value = dataMgr.model[fieldName].value;
                if (typeof dataMgr.model[fieldName].tref !== 'undefined') {
                    fieldName = dataMgr.model[fieldName].tref+'.'+fieldName;
                }
            }
            conditions.push(fieldName+"=?");
            values.push(value);
        });
        var condition = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
        var query = 'SELECT '+select+' FROM '+tableName+condition;
        return this.execute(dataMgr.dbName, query, values, callback);
    },
    
    getJoinedTables: function(joinedTables, joinToTref, values) {
        var joinedTableString = '';
        for (var i = 0; i < joinedTables.length; i++ ) {
            var table = joinedTables[i];
            if (table.joinToTref == joinToTref) {
                // Call recursively to look for other tables joined to this one
                var lowerTables = this.getJoinedTables(joinedTables, table.tref, values);
                
                var open = (lowerTables == '') ? '' : '(';
                var close = (lowerTables == '') ? '' : ')';
                joinedTableString += ' ' + table.type+' JOIN '+open;
                joinedTableString += table.tableName;
                joinedTableString += ' AS '+table.tref;
                joinedTableString += lowerTables+close;
                joinedTableString += ' ON '+table.joinToTref+'.'+table.foreignKey;
                joinedTableString += ' = '+table.tref+'.'+ (table.referencedKey || table.foreignKey);
                if (typeof table.condition != 'undefined') {
                    for (var j = 0; j < table.condition.length; j++ ) {
                        var condition = table.condition[j];
                        joinedTableString += ' AND '+condition.tref+'.'+condition.key+'=?';
                        values.push(condition.value);
                    }
                }
            }
        }
        return joinedTableString;
    },

    // Expand query to include values
    expandQuery: function(query, values) {
        values = values || [];
        var index = 0;
        var expandedQuery = query.replace(/(\?)/g, function() {
            var value = values[index++];
            if (typeof value === 'string') {
                // Single-quote strings
                value = "'"+value+"'";
            }
            return value;
        });
        return expandedQuery;
    },
    
    // Execute the specified SQLite query
    execute: function(dbName, query, values, callback) {
        // Execute the query
        var database = require('db/database').open(dbName);
        var result = database.execute(this.expandQuery(query, values));
        var dfd = $.Deferred();
        if (result) {
            // Process the result
            
            // Get the names of the fields in the result set
            var fieldNames = [];
            // fieldCount is a property on Android and a method on iOS 
            var fieldCount = $.isFunction(result.fieldCount) ? result.fieldCount() : result.fieldCount;
            for (var field = 0; field < fieldCount; ++field) {
                fieldNames.push(result.fieldName(field));
            }
            
            // Populate the rows array
            var rows = [];
            while (result.isValidRow()) {
                var row = {};
                for (var i = 0; i < fieldNames.length; ++i) {
                    var fieldName = fieldNames[i];
                    row[fieldName] = result.fieldByName(fieldName);
                }
                rows.push(row);
                result.next();
            }
            result.close();
            
            // Create and resolve a deferred that resolves to the data returned by the query
            dfd.resolve([rows, fieldNames]);
        }
        else if (query.substr(0, 6) === 'INSERT') {
            // Get the row data of the just inserted row through a findOne call
            var insertId = database.getLastInsertRowId();
            dfd.resolve(insertId);
        }
        else {
            // Create and resolve a deferred that resolves to no data
            dfd.resolve({});
        }
        
        // Call the callback when the operation finished (which is immediately because it is synchronous)
        if ($.isFunction(callback)) { 
            dfd.done(function(data) {
                var args = $.isArray(data) ? data.slice(0) : [data];
                args.unshift(null);
                callback.apply(null, args);
            }).fail(function(err) {
                callback(err, {});
            });
        }
        
        // Close the database connection to conserve resources
        database.close();
    }
}, {});
