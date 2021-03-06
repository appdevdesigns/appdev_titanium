var AD = require('AppDev');
var $ = require('jquery');

var ADModel = module.exports = {
    extend: function(name, definition, instanceMethods) {
        // Determine the base model class to derive from based on the connectionType specified in the model definition
        var BaseModel = null;
        
        var staticProperties = $.extend(true, {
            __adModule: definition._adModule,
            __adModel: definition._adModel,
            attributes: {},
            defaults: {}
        }, ADModel.staticProperties, definition);
        if (staticProperties.type === 'multilingual') {
            staticProperties.defaults.language_code = '';
        }
        
        var modelFields = staticProperties.modelFields || ($.extend({}, staticProperties.fields.data, staticProperties.fields.trans));
        var attributes = staticProperties.attributes;
        var defaults = staticProperties.defaults;
        $.each(modelFields, function(field) {
            // Add all remaining model fields to the attributes dictionary, giving them the default type
            // This is to ensure the $.Model is aware of each of the defined attributes, not just the ones with special types
            if (!attributes[field]) {
                attributes[field] = 'default';
            }
            // Set the model field default value to null for all fields without an explicit default value
            if (typeof defaults[field] === 'undefined') {
                defaults[field] = null;
            }
        });
        
        // Lookup the connection type name in the ConnectionTypes array and assign it the default value if it could not be found
        var connectionTypes = AD.Defaults.Model.ConnectionTypes;
        var connection = connectionTypes[staticProperties.connectionType || AD.Defaults.Model.defaultConnectionType];
        if (connection === connectionTypes.local || connection === connectionTypes.synced) {
            var LocalModel = null;
            if (staticProperties.type === 'single') {
                LocalModel = AD.Model.ModelSQL;
            }
            else if (staticProperties.type === 'multilingual') {
                LocalModel = AD.Model.ModelSQLMultilingual;
            }
            else {
                // Default to the basic ModelSQL
                console.warn('Unknown model type: ['+staticProperties.type+']!  Defaulting to single (AD.Model.ModelSQL)');
                LocalModel = AD.Model.ModelSQL;
            }
            
            if (connection === connectionTypes.local) {
                // Derive from the determined local model
                BaseModel = LocalModel;
            }
            else if (connection === connectionTypes.synced) {
                // Derive from the SyncedModel model
                BaseModel = AD.Model.SyncedModel;
                staticProperties.LocalModel = LocalModel;
            }
        }
        else if (connection === connectionTypes.server) {
            // Derive from the ServerModel model
            BaseModel = AD.Model.ServerModel;
        }
        else {
            console.error('Invalid connection type ['+connection+']!');
            return null;
        }
        
        $.extend(instanceMethods, ADModel.prototypeProperties);
        
        if (staticProperties.hasUuid) {
            // The primary key is an automatically generated UUID field
            Object.defineProperty(staticProperties.defaults, staticProperties.primaryKey, {
                get: function() {
                    // Generate a new uuid
                    return AD.Model.generateUuid();
                },
                enumerable: true,
                configurable: true
            });
        }
        
        // Add a getter function to the specified model field
        var addGetter = function(field, getter) {
            // Add the getter instance method
            instanceMethods['get'+$.String.classize(field)] = getter;
            // Mark this field as an attribute
            staticProperties.attributes[field] = 'default';
        };
        
        // Add getters for lookup label fields
        if (staticProperties.lookupLabels) {
            $.each(staticProperties.lookupLabels, function(field, lookupField) {
                addGetter(lookupField.label, function() {
                    // Assume that the lookup label is referenced by its foreign key
                    var ReferencedModel = AD.Model.lookup(lookupField.tableName);
                    var referencedModel = ReferencedModel.cache.getById(this.attr(lookupField.foreignKey));
                    return referencedModel && referencedModel.attr(lookupField.label);
                });
            });
        }
        
        var Model = BaseModel.extend(name, staticProperties, instanceMethods);
        
        // Create the cache only if the model's static 'cache' property equals true
        if (definition.cache === true) {
            // Create the cache class and save it to Model.Cache
            var Cache = $.Model.Cache(Model.name+'.Cache', {
                Model: Model
            }, {});
            
            // Create the cache, but do not actually build the cache until refreshCaches is called
            // This overwrites the cache=true property
            Model.cache = new Cache({ createCache: false });
        }
        
        // Store the model in AD.Models and AD.Model.indexedModels
        AD.Models[Model.shortName] = Model;
        if (Model.type === 'single') {
            ADModel.indexedModels[Model.dbTable] = Model;
        }
        else if (Model.type === 'multilingual') {
            ADModel.indexedModels[Model.tables.data] = ADModel.indexedModels[Model.tables.trans] = Model;
        }
        
        Model.bind('created', function(event, model) {
            // This model is no longer new because it has now been saved to the database
            model.isSaved = true;
        });
        
        return Model;
    },
    // All instances derived from AD.Model will have these static properties
    staticProperties: {
        convert: {
            integer: function(raw) {
                return parseInt(raw, 10);
            },
            float: function(raw) {
                return parseFloat(raw);
            },
            bool: function(raw) {
                var values = {
                    '0': false,
                    '1': true,
                    'false': false,
                    'true': true
                };
                return values[raw] || null;
            },
            date: function(raw) {
                if (typeof raw === 'string') {
                    var matches = raw.match(/(\d+)-(\d+)-(\d+)/);
                    return matches ? new Date(matches[1], (+matches[2])-1, matches[3]) : matches;
                }
                // else if (raw instanceof Date) fails in Android because the date was likely to have been
                // created in a different Javascript execution context, similar to iframes in the browser
                else if (Object.prototype.toString.call(raw) === '[object Date]') {
                    return raw;
                }
                else {
                    console.error('Unknown date type!');
                    console.log('raw = '+JSON.stringify()+' ['+typeof raw+']');
                    return;
                }
            },
            JSON: function(raw) {
                return (typeof raw === 'string') ? JSON.parse(raw) : raw;
            }
        },
        serialize: {
            date: function(val, type) {
                return (Object.prototype.toString.call(val) === '[object Date]') ? (val.getFullYear() + '-' + (val.getMonth() + 1) + '-' + val.getDate()) : null;
            },
            JSON: function(val) {
                return (typeof val === 'object') ? JSON.stringify(val) : val;
            }
        },
        
        // Refresh the model cache
        refreshCache: function() {
            var Model = this;
            var name = Model.shortName;
            
            // If cache=true in the model definition, Model.cache will be overwritten
            // with the cache object, but it will remain a 'truthy' value
            var cache = Model.cache;
            if (!cache) {
                return $.Deferred().resolve();
            }
            
            console.log('Building '+name+' cache...');
            // Only load models associated with this viewer
            var filter = { viewer_id: AD.Viewer.viewer_id };
            // Expand the cache filter to include the filter specified in the model definition
            var cacheFilter = Model.cacheFilter;
            if ($.isFunction(cacheFilter)) {
                cacheFilter = Model.cacheFilter();
            }
            var cacheDfd = $.Deferred();
            $.when(cacheFilter).done(function(trueCacheFilter) {
                // If cacheFilter is a deferred, this will be executed after it is resolved
                // If it is a plain object, this will be executed immediately
                $.extend(filter, trueCacheFilter);
                
                // Set the cache filter and build the cache
                cache.setFilter(filter);
                cache.refresh().then(cacheDfd.resolve, cacheDfd.reject);
            }).fail(cacheDfd.reject);
            return cacheDfd.done(function() {
                console.log('Built '+name+' cache');
            });
        },
        
        // Override findAll and findOne to track whether or not models have ever been saved
        findAll: function() {
            return this._super.apply(this, arguments).done(function(models) {
                models.forEach(function(model) {
                    model.isSaved = true;
                });
            });
        },
        findOne: function() {
            return this._super.apply(this, arguments).done(function(model) {
                model.isSaved = true;
            });
        }
    },
    // All instances derived from AD.Model will have these prototype properties
    prototypeProperties: {
        isNew: function() {
            // Models created via findAll or findOne will have an isSaved property set to true, while
            // models created via "new Model(...)" will not. Thus, to check whether or not this is a
            // new model that is never been saved, we can check whether or not this property is falsy.
            return !this.isSaved;
        }
    },
    
    indexedModels: {},
    lookup: function(tableName) {
        return ADModel.indexedModels[tableName];
    },
    
    // Refresh all of the model caches
    refreshCaches: function() {
        var dfd = $.Deferred();
        var refreshDfds = [];
        $.each(AD.Models, function(name, Model) {
            refreshDfds.push(Model.refreshCache());
        });
        // When all deferreds in refreshDfds have resolved, then resolve the returned deferred
        $.when.apply($, refreshDfds).done(function() {
            console.log('All model caches built');
            dfd.resolve();
        }).fail(function(error) {
            console.error('Model cache building failed');
            dfd.reject({
                description: 'Could not load application data',
                technical: error,
                fix: AD.Defaults.development ?
                    'Please verify that the NextSteps AppDev module is enabled through the component manager interface.' :
                    'Please verify that the server is accessible.'
            });
        });
        return dfd.promise();
    },
    
    // Generate and return a universally unique identifier
    generateUuid: function() {
        var hash = Ti.Utils.sha1(Ti.Platform.id + Date.now() + Math.random());
        var uuid = hash.slice(0, 8) + '-' + hash.slice(8, 12) + '-' + '5' + hash.slice(13, 16) + '-' + (parseInt(hash[17], 16) & 0x3 | 0x8).toString(16) + hash.slice(17, 20) + '-' + hash.slice(20, 24) + '-' + hash.slice(24, 32);
        return uuid;
    }
};

// Date and default converters/serializers are already provided for dates by $.Model, so merge them in
ADModel.staticProperties.convert = $.extend({}, $.Model.convert, ADModel.staticProperties.convert);
ADModel.staticProperties.serialize = $.extend({}, $.Model.serialize, ADModel.staticProperties.serialize);
