var jQuery = require('jquery');

jQuery.dev = {};
['debug', 'error', 'info', 'log', 'warn'].forEach(function(level) {
    jQuery.dev[level] = function(message) {
        // Output to the console only during development
        if (Ti.App.deployType !== 'production') {
            return console[level](message);
        }
    };
});
