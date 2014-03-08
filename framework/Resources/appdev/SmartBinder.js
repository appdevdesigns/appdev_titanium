var $ = require('jquery');
module.exports = $.Class('AD.SmartBinder', {
    bindUnbindPairs: {
        'bind': 'unbind',
        'addEventListener': 'removeEventListener'
    },
    bindDefinitionFields: ['object', 'bindFuncName', 'eventName', 'callback'],
    defaultBind: 'bind'
}, {
    // Initialize the SmartBinder instance
    init: function(options) {
        this.options = options;
        this.bindings = [];
    },
    
    // Return an binding bound by bind, or null if it could not be found
    // Receives the same parameters as bind or a binding object
    lookupBinding: function() {
        var binding = this.parseArgs.apply(this, arguments);
        var foundBinding = null;
        this.bindings.forEach(function(currentBinding, index) {
            if ($.compareObjects(currentBinding, binding, this.constructor.bindDefinitionFields)) {
                foundBinding = {
                    binding: currentBinding,
                    index: index
                };
            }
        }, this);
        return foundBinding;
    },
    
    // Parse the arguments array and return an object representing a binding
    parseArgs: function() {
        var argArray = $.makeArray(arguments);
        if (argArray.length === 1) {
            // The first argument is the binding object
            return argArray[0];
        }
        if (argArray.length === 3) {
            // The bindFuncName parameter is not present, so set it to the default
            argArray.splice(1, 0, this.constructor.defaultBind);
        }
        
        // Equivalent to:
        //return {
        //    object: argArray[0],
        //    bindFuncName: argArray[1],
        //    eventName: argArray[2],
        //    callback: argArray[3]
        //};
        var binding = {};
        this.constructor.bindDefinitionFields.forEach(function(field, index) {
            binding[field] = argArray[index];
        });
        return binding;
    },
    
    // Add an event listener that can be remembered and easily unbound
    // bindFuncName is optional and defaults to SmartBinder.defaultBind
    // Roughly equivalent to object[bindFuncName](eventName, callback)
    bind: function(/* object, bindFuncName, eventName, callback */) {
        var binding = this.parseArgs.apply(this, arguments);
        if (this.lookupBinding(binding)) {
            // This exact same binding has already been bound, so do not bind it again
            return;
        }
        
        // Save the binding so that it can be unbound later
        this.bindings.push(binding);
        
        // Lookup the name of the unbind function
        binding.unbindFuncName = this.constructor.bindUnbindPairs[binding.bindFuncName];
        
        var instance = this.options.instance;
        // Use the proxy function of the object that owns this SmartBinder instance, if present, resorting to jQuery.proxy if it is not
        binding.proxiedCallback = instance.proxy ? instance.proxy(binding.callback) : $.proxy(binding.callback, this.options.instance);
        
        // Now bind the event listener
        binding.object[binding.bindFuncName](binding.eventName, binding.proxiedCallback);
    },
    
    // Remove an event listener added by bind
    // Receives the same parameters as bind or a binding object
    unbind: function() {
        var binding = this.parseArgs.apply(this, arguments);
        var existingBinding = this.lookupBinding(binding);
        if (!existingBinding) {
            // This binding was not bound with bind or has already been removed
            return;
        }
        
        // Remove the binding from the bindings array
        this.bindings.splice(existingBinding.index, 1);
        
        // Now unbind the event listener
        binding.object[binding.unbindFuncName](binding.eventName, binding.proxiedCallback);
    },
    
    // Remove all event listeners
    unbindAll: function() {
        while (this.bindings.length > 0) {
            this.unbind(this.bindings[0]);
        }
    }
});
