var $ = require('jquery');

var steal = module.exports = function() {
    // Convert the arguments object to an arguments array
    var args = Array.prototype.slice.call(arguments);
    var lastArg = args[args.length - 1];
    var onDone = null;
    if (typeof lastArg === "function") {
        onDone = lastArg;
        args.pop();
    }
    
    args.forEach(function(arg) {
        if (steal.includedFiles.indexOf(arg) === -1) {
            // This file has never been included before, so include it now
            Ti.API.info('Stealing '+arg);
            steal.includedFiles.push(arg);
            require(arg);
        }
    });
    
    if (onDone) {
        onDone($);
    }
    
    // Return steal for chaining
    return steal;
};

// then() does the same thing as steal()
steal.then = steal;

steal.dev = {
    log: function(message) {
        Ti.API.info(message);
    },
    warn: function(message) {
        Ti.API.warn(message);
    }
};

// The list of included file paths
steal.includedFiles = [];
