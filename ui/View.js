var $ = require('jquery');
var AD = require('AppDev');

// Create a generic window class
$.Class('jQuery.View', {
    setup: function() {
        if (this.dependencies) {
            // When a view extends this base view, load all of its AppDev UI dependencies 
            this.dependencies.forEach(function(dependency) {
                require('ui/'+dependency);
            });
        }
        // Call the base class setup function
        this._super.apply(this, arguments);
    },
    defaults: {
        enabled: true
    },
    create: function(view) {
        return new $.View({view: view});
    }
}, {
    setup: function(options) {
        // Set this.options to options merged recursively with this.constructor.defaults
        this.options = $.extend(true, {}, this.constructor.defaults, options || {});
    },
    init: function(options) {
        // If 'init' is called via this._super(...) in a derived class, make sure that the new options are added to this.options
        $.extend(true, this.options, options);
        
        var _this = this;
        
        this.unnamedChildren = 0;
        this.children = {};
        
        this.view = this.options.view;
        this.view.has$View = true;
        this.view.get$View = function() {
            // Allow the Titanium.UI view to reference the $.View
            return _this;
        };
        
        this.setEnabled(this.options.enabled);
        
        this.smartBinder = new AD.SmartBinder({ instance: this });
        
        // If specified, wait until createDfd or initializeDfd resolves before
        // calling this.create or this.initialize, otherwise execute immediately
        $.when(this.options.createDfd).done(function() {
            _this.create();
        });
        $.when(this.options.initializeDfd).done(function() {
            _this.initialize();
        });
    },
    
    // Cleanup, similar to a destructor
    destroy: function() {
        this.smartBinder.unbindAll();
        
        // Destroy all child views that are $.View instances and not just Titanium.UI.View instances
        $.each(this.children, function(name, child) {
            if (child.has$View) {
                child.get$View().destroy();
            }
        });
    },
    
    // Create the necessary child views for the view (should be overriden by derived classes)
    // This should create window such that 'create' can be called once to create a single
    // window instance that can be reused by calling 'initialize' to reset its contents.
    create: function() {
    },
    // Initialize the views created by 'create'
    initialize: function() {
    },
    
    // Add a child to this view
    add: function(name, child, justRecord /* for internal use only */) {
        if (typeof name === 'object') {
            // The optional name parameter was omitted, so give it an auto-generated name: __unnamedXXX
            child = name;
            name = '__unnamed' + this.unnamedChildren;
            this.unnamedChildren += 1;
        }
        
        // If the child is a $.View instance, extract the view object
        var childView = child.isView ? child.getView() : child;
        
        // Add it to the children map and to the view
        this.children[name] = childView;
        if (justRecord) {
            // If justRecord is set to true, the view is saved in the view's children map, but is NOT actually added to the view
            // This can be usefull for saving descendents more than one level deep to the children map
            childView.notAdded = true;
        }
        else {
            // Normal behavior; add child to the view
            this.view.add(childView);
        }
        return child; // for convenience
    },
    
    // Just like 'add' except that the view is saved in the view's children map, but is NOT actually added to the view
    // This can be usefull for saving descendents more than one level deep to the children map
    record: function(name, child) {
        return this.add(name, child, true);
    },
    
    // addTo and recordOn are very similar to add and record except that this view
    // is added to/record on the parent instead of the other way around
    // These methods support chaining and help to mitigate the several nested functions
    // that are often necessary to acheive the same effect with add and record
    addTo: function(name, parent) {
        if (typeof name !== 'string') {
            // The name argument was omitted
            parent = name;
        }
        return parent.add(name, this); // allow chaining
    },
    recordOn: function(name, parent) {
        if (typeof name !== 'string') {
            // The name argument was omitted
            parent = name;
        }
        return parent.record(name, this); // allow chaining
    },
    
    // Return the view with the specified name as a Titanium.UI.View instance
    getChild: function(name) {
        return this.children[name];
    },
    // Return the view with the specified name as a $.View instance
    get$Child: function(name){
        return this.children[name].get$View();
    },
    
    // Enable/disable the view
    setEnabled: function(enabled) {
        this.enabled = enabled;
        
        // Set the enabled property of buttons, and manually adjust the transparency for other views
        if (this.view.toString() === '[object TiUIButton]' || this.view.toString() === '[object Button]') {
            this.view.enabled = enabled;
        }
        else {
            this.view.opacity = this.enabled ? 1 : 0.25;
        }
    },
    
    addEventListener: function(name, callback) {
        var _this = this;
        this.view.addEventListener(name, function() {
            if (_this.enabled) {
                // Only call the callback if the view is enabled
                return callback.apply(_this, arguments);
            }
        });
    },
    
    // See AD.SmartBinder.bind
    smartBind: function() {
        this.smartBinder.bind.apply(this.smartBinder, arguments);
    },
    // See AD.SmartBinder.unbind
    smartUnbind: function() {
        this.smartBinder.unbind.apply(this.smartBinder, arguments);
    },
    
    isView: true, // is a member of the view class
    
    // Return the view
    getView: function() {
        return this.view;
    }
});
