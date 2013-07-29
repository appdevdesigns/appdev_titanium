var AD = require('AppDev');
var $ = require('jquery');

var SyncedModel = module.exports = $.Model('AD.Model.SyncedModel', {
    overrideMethod: function(object, name, method) {
        var original = object[name];
        object[name] = function() {
            // Delegate to the original method, likely the LocalModel version, if sync is disabled
            return (AD.Defaults.syncEnabled ? method : original).apply(this, arguments);
        };
    },
    
    // Override the default extend function
    extend: function(fullName, klass, proto) {
        var LocalModel = klass.LocalModel; // one of AD.Model.ModelSQL, AD.Model.ModelSQLMultilingual
        var ServerModel = AD.Model.ServerModel;
        
        // Give LocalModel priority in the event of conflicts
        staticProps = $.extend({}, ServerModel, LocalModel, klass);
        protoProps = $.extend({}, ServerModel.prototype, LocalModel.prototype, proto);
        
        ['create', 'update', 'destroy'].forEach(function(operation) {
            // Override the operation with a proxy function that delegates the operation
            // to the model specified by the delegatedModel property on the SyncedModel class
            this.overrideMethod(staticProps, operation, function() {
                // Delegate the operation to the specified model, should be LocalModel or ServerModel
                return this.delegatedModel[operation].apply(this, arguments);
            });
       }, this);
        
        // Override the save and destroy model prototype functions 
        ['save', 'destroy'].forEach(function(operation) {
            this.overrideMethod(protoProps, operation, function() {
                // When a model is saved (created/updated) or destroyed, save the model using first LocalModel, then
                // using ServerModel. The 'delegatedModel' property determines which model should handle the operation.
                var self = this;
                var args = arguments;
                var _super = self._super;
                
                // First save using LocalModel
                self.freeze();
                self.constructor.delegatedModel = LocalModel;
                return _super.apply(self, args).done(function() {
                    // When that finishes, then save using ServerModel
                    self.constructor.delegatedModel = ServerModel;
                    _super.apply(self, args).done(function() {
                        self.constructor.delegatedModel = null;
                    });
                    self.unfreeze();
                });
            });
        }, this);
        
        ['created', 'updated', 'destroyed'].forEach(function(operation) {
            this.overrideMethod(protoProps, operation, function() {
                // Ignore if this call is the result of a completed ServerModel operation
                if (this.constructor.delegatedModel !== ServerModel) {
                    return this._super.apply(this, arguments);
                }
            });
        }, this);
        
        // Support the ability to "freeze" a model before updating it on the server.
        // A frozen model retains the same value of isNew() as it was when it was frozen.
        protoProps.freeze = function() {
            this.freezeData = {
                isNew: this.isNew()
            };
            this.frozen = true;
        };
        protoProps.unfreeze = function() {
            this.freezeData = null;
            this.frozen = false;
        };
        protoProps.isNew = function() {
            return this.frozen ? this.freezeData.isNew : this._super.apply(this, arguments);
        };
        
        // Now allow the default extend function to do its work
        var DerivedClass = this._super.call(this, fullName, staticProps, protoProps);
        
        // Call the setup functions, if present
        [LocalModel.setup, ServerModel.setup].forEach(function(setup) {
            if ($.isFunction(setup)) {
                setup.call(DerivedClass, SyncedModel, staticProps, protoProps);
            }
        });
        return DerivedClass;
    }
}, {});
