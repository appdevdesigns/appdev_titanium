var jQuery = module.exports = require('jquery');
jQuery.fn.extend({
    bind: function(type, fn) {
        return this.each(function() {
            if (!this._events) {
                this._events = {};
            }
            if (!this._events[type]) {
                this._events[type] = [];
            }
            this._events[type].push(fn);
        });
    },
    unbind: function(type, fn) {
        return this.each(function() {
            if (!this._events) {
                return;
            }
            if (!type) {
                // No arguments given, unbind ALL events
                this._events = {};
            }
            else if (!fn) {
                // No function given, unbind all handlers of the specified type
                delete this._events[type];
            }
            else if (this._events[type]) {
                var handlers = this._events[type];
                for (var i = 0; i < handlers.length; ++i) {
                    if (handlers[i] === fn) {
                        this._events[type].splice(i, 1);
                    }
                }
            }
        });
    },
    
    trigger: function(type, data, elem) {
        // Clone any incoming data and prepend the event, creating the handler arg list
        var args = (data === null ? [] : jQuery.makeArray(data));
        args.unshift({ type: type }); // prepend event object
        
        this.each(function() {
            if (this._events) {
                var events = jQuery.mergeArrays(this._events[type], this._events['*']);
                events.forEach(function(fn) {
                    fn.apply(elem, args);
                });
            }
        });
        return this;
    }
});
