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
                
                var open = (lowerTables === '') ? '' : '(';
                var close = (lowerTables === '') ? '' : ')';
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
                // Single-quote strings and escape single quotation marks
                value = "'"+value.replace(/'/g, "''")+"'";
            }
            return value;
        });
        return expandedQuery;
    },
    
    openDatabases: {}, // dictionary of open database connections, indexed by the database name
    openDatabase: function(dbName) {
        if (this.openDatabases[dbName]) {
            return this.openDatabases[dbName];
        }
        else {
            return this.openDatabases[dbName] = require('appdev/db/database').open(dbName);
        }
    },
    
    // Execute the specified SQLite query
    execute: function(dbName, query, values, callback) {
        // Execute the query
        var database = this.openDatabase(dbName);
        var expandedQuery = this.expandQuery(query, values);
        console.log(expandedQuery);
        var result = database.execute(expandedQuery);
        var dfd = $.Deferred();
        if (result) {
            // Process the result
            
            // Get the names of the fields in the result set
            var fieldNames = [];
            Ti.API.log(result.fieldCount());
            var fieldCount = result.fieldCount();
            for (var field = 0; field < fieldCount; ++field) {
                fieldNames.push(result.fieldName(field));
            }
            
            // Populate the rows array
            var rows = [];
            while (result.isValidRow()) {
                var row = {};
                fieldNames.forEach(function(fieldName) {
                    row[fieldName] = result.fieldByName(fieldName);
                });
                rows.push(row);
                result.next();
            }
            result.close();
            
            // Return the row data and field names in an array
            dfd.resolve([rows, fieldNames]);
        }
        else if (query.substr(0, 6).toUpperCase() === 'INSERT') {
            // Return the primary key of the row inserted
            var rowIdResult = database.execute('SELECT last_insert_rowid()');
            var insertId = rowIdResult.fieldByName('last_insert_rowid()');
            rowIdResult.close();
            dfd.resolve(insertId);
        }
        else {
            // There is no data to return
            dfd.resolve({});
        }
        
        // Call the callback when the operation finishes (which is immediately because it is synchronous)
        if ($.isFunction(callback)) { 
            dfd.done(function(data) {
                // The first callback argument, err, will be null, followed by the arguments in the 'data' array
                var args = $.isArray(data) ? data.slice(0) : [data];
                args.unshift(null);
                callback.apply(null, args);
            }).fail(function(err) {
                callback(err, {});
            });
        }
        // Pipe the deferred to ensure that the callback option is executed before any attached callbacks are executed
        return dfd.pipe();
    }
}, {});
