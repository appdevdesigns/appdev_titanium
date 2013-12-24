var steal = require('appdev/jquery/steal');
steal('jquery/model').then(function($) {
    $.Class('jQuery.Model.Cache', {
        defaults: {
            createCache: true, // the cache is built upon instantiation by default,
            filter: {}
        },
        
        // Return a boolean indicating whether the model matches the filter
        matchesFilter: function(model, filter) {
            var matches = true;
            $.each(filter, function(key, value) {
                if (model.constructor.modelFields[key] && model.attr(key) !== filter[key]) {
                    // The property is in the model definition and does not match the filter, so the model does not match the filter
                    matches = false;
                    return false; // stop looping
                }
            });
            return matches;
        }
    }, {
        setup: function(options) {
            // Merge options and the static 'defaults' property to produce this.options
            this.options = $.extend({}, this.constructor.defaults, options || {});
            this.setFilter(options.filter);
        },
        init: function() {
            this.Model = this.constructor.Model;
            this.modelArray = [];
            this.modelMap = {};
            if (this.options.createCache) {
                // Create the cache
                this.refresh();
            }
    
            this.Model.bind('created', this.proxy(function(event, model) {
                if (this.constructor.matchesFilter(model, this.filter)) {
                    // Only add models that match the filter
                    this.addModel(model);
                }
            }));
            this.Model.bind('destroyed', this.proxy(function(event, model) {
                // Always removed destroyed models from the cache, whether they match
                // the filter or not, to ensure that it never contains stale models
                this.removeModel(model);
            }));
            this.Model.bind('updated', this.proxy(function(event, model) {
                if (this.constructor.matchesFilter(model, this.filter)) {
                    // Add the updated model to the cache
                    // If it is already present, it will not be added again
                    this.addModel(model);
                }
                else {
                    // Remove updated models that do not match the filter anymore
                    // This still works even if the model was never in the cache
                    this.removeModel(model);
                }
            }));
        },
        // Add model to the cache
        addModel: function(model) {
            // Only add the model if the model is not already present in the cache
            var id = model.getId();
            var existingModel = this.getById(id);
            if (!existingModel) {
                this.modelArray.push(model);
                this.modelMap[id] = model;
            }
        },
        // Remove model to the cache
        removeModel: function(model) {
            var index = this.modelArray.indexOf(model);
            if (index !== -1) {
                this.modelArray.splice(index, 1);
            }
            delete this.modelMap[model.getId()];
        },
        // Set the cache filter
        setFilter: function(filter) {
            // Merge filter and the static 'filter' property that the cache
            // class could have been created with to produce this.filter
            this.filter = $.extend({}, this.constructor.filter || {}, filter);
        },
        // Recreate the cache asynchronously, returning a deferred promise
        refresh: function() {
            this.modelArray = [];
            this.modelMap = {};
            var _this = this;
            var dfd = this.Model.findAll(this.filter);
            dfd.done(function(models) {
                models.forEach(_this.proxy('addModel'));
            });
            return dfd.promise();
        },
        // Return the model array
        getArray: function() {
            return this.modelArray;
        },
        // Return the model instance with the specified id
        getById: function(id) {
            return this.modelMap[id];
        },
        // Return an array of model instances that match the query
        query: function(filter) {
            return this.modelArray.filter(function(model) {
                return this.constructor.matchesFilter(model, filter);
            }, this);
        }
    });
});
