var $ = require('jquery');
var AD = require('AppDev');

// Create a model subclass that represents a locally stored database that other models can derive from
module.exports = $.Class('AD.DataStore.SQLite', {
    create: function(dataMgr, callback) {
        var columns = [];
        var values = [];
        $.each(dataMgr.model, function(key, value) {
            columns.push(key);
            values.push(value);
        });
        var valuesClause = ' ('+ columns.join(', ') + ') VALUES ('+ $.createArray(columns.length, '?').join(', ') + ')';
        var query = 'INSERT INTO '+dataMgr.dbTable+(columns.length === 0 ? ' DEFAULT VALUES' : valuesClause);
        return this.execute(dataMgr.dbName, query, values, callback);
    },
    
    update: function(dataMgr, callback) {
        var conditions = [];
        var values = [];
        $.each(dataMgr.model, function(key, value) {
            conditions.push(key+'=?');
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
            conditions.push(key+'=?');
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
            $.each(dataMgr.selectedFields, function(fieldName, field) {
                // These fields all have a tref prepended
                selectFields.push(field.tref+'.'+fieldName);
            });
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
            conditions.push(fieldName+'=?');
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
            if (table.joinToTref === joinToTref) {
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
                if (typeof table.condition !== 'undefined') {
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
                value = '\''+value.replace(/'/g, '\'\'')+'\'';
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
            return (this.openDatabases[dbName] = AD.Database.open(dbName));
        }
    },
    
    // Execute a raw database query
    rawExecute: function(dbName, query) {
        // Use select to query encrypted databases on Android, because otherwise, the SQL Encryption
        // module may not return a result set, especially when executing PRAGMA queries
        var command = query.split(' ')[0].toUpperCase();
        var database = this.openDatabase(dbName);
        return (AD.Platform.isAndroid && AD.EncryptionKey.encryptionActivated() && (command === 'SELECT' || command === 'PRAGMA')) ? database.select(query) : database.execute(query);
    },
    
    // Execute the specified SQLite query
    execute: function(dbName, query, values, callback) {
        if ($.isFunction(values)) {
            // The 'values' parameter was omitted
            callback = values;
            values = [];
        }
        
        // Execute the query
        var expandedQuery = this.expandQuery(query, values);
        console.log(expandedQuery);
        var result = this.rawExecute(dbName, expandedQuery);
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
            var row = null;
            var setValue = function(fieldName) {
                row[fieldName] = result.fieldByName(fieldName);
            };
            while (result.isValidRow()) {
                row = {};
                fieldNames.forEach(setValue);
                rows.push(row);
                result.next();
            }
            result.close();
            
            // Return the row data and field names in an array
            dfd.resolve([rows, fieldNames]);
        }
        else if (query.substr(0, 6).toUpperCase() === 'INSERT') {
            // Return the primary key of the row inserted
            var rowIdResult = this.rawExecute(dbName, 'SELECT last_insert_rowid()');
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
    },
    
    // Disable foreign key checks
    disableForeignKeys: function(dbName) {
        this.execute(dbName, 'PRAGMA foreign_keys = OFF');
    },
    // Enable foreign key checks
    enableForeignKeys: function(dbName) {
        this.execute(dbName, 'PRAGMA foreign_keys = ON');
    },
    
    // Export the entire database, represented as a Javascript object
    exportDatabase: function(dbName) {
        var self = this;
        var dfd = $.Deferred();
        self.execute(dbName, 'SELECT name FROM sqlite_master WHERE type="table"').done(function(tableArgs) {
            var dump = {
                tables: {}
            };
            
            var tables = tableArgs[0];
            tables.forEach(function(table) {
                var tableName = table.name;
                self.exportTable(dbName, tableName).done(function(tableDump) {
                    dump.tables[tableName] = tableDump;
                }).fail(dfd.reject);
            });
            // This assumes that the "execute" call is blocking, which it is
            dfd.resolve(dump);
        }).fail(dfd.reject);
        return dfd.promise();
    },
    
    // Import the database, represented as a Javascript object
    importDatabase: function(dbName, dump) {
        var self = this;
        var dfd = $.Deferred();
        // Import each the table from the dump
        $.each(dump.tables, function(tableName, tableDump) {
            self.importTable(dbName, tableName, tableDump).fail(dfd.reject);
        });
        // This assumes that the "execute" call is blocking, which it is
        dfd.resolve();
        return dfd.promise();
    },
    
    // Export a single database table, represented as a Javascript object
    exportTable: function(dbName, tableName) {
        var dfd = $.Deferred();
        this.execute(dbName, 'SELECT * FROM ?', [tableName]).done(function(rowArgs) {
            dfd.resolve(rowArgs[0]);
        }).fail(dfd.reject);
        return dfd.promise();
    },
    
    // Import a single database table, represented as a Javascript object
    importTable: function(dbName, tableName, rows) {
        var self = this;
        var dfd = $.Deferred();
        this.disableForeignKeys(dbName); // temporarily disable foreign key checks
        
        // Get the table schema
        this.execute(dbName, 'PRAGMA table_info(?)', [tableName]).done(function(tableInfoArgs) {
            // If the "PRAGMA table_info" table returned zero rows the table does not exist.
            // In this case, simply ignore the table and do not attempt to import the table data.
            if (!tableInfoArgs[0]) {
                return;
            }
            
            // Extract the column names from the table's database schema
            var columnNames = tableInfoArgs[0].map(function(column) {
                return column.name;
            });
            
            // Empty the table
            self.execute(dbName, 'DELETE FROM ?', [tableName]).done(function() {
                // Now insert the data back in
                var values = null;
                var rowToValues = function(row) {
                    return columnNames.map(function(rowName) {
                        values.push(row[rowName]);
                        return '?';
                    }).join(',');
                };
                var maxInserts = 250;
                for (var startRow = 0; startRow < rows.length; startRow += maxInserts) {
                    values = [tableName];
                    var selectSQL = rows.slice(startRow, startRow + maxInserts).map(rowToValues).join(' UNION ALL SELECT ');
                    self.execute(dbName, 'INSERT INTO ? ('+columnNames.join(',')+') SELECT '+selectSQL, values).fail(dfd.reject);
                }
            }).fail(dfd.reject);
        }).fail(dfd.reject);
        
        this.enableForeignKeys(dbName); // re-enable foreign key checks
        
        // This assumes that the "execute" call is blocking, which it is
        dfd.resolve();
        return dfd.promise();
    }
}, {});
