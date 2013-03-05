var jQuery = require('jquery');

// Add other components to jQuery
// These modules will all update the jQuery object defined in jquery.js
require('appdev/jquery/jquery-event');
require('appdev/jquery/jquery-callbacks');
require('appdev/jquery/jquery-deferred');
require('appdev/jquery/tiajax');
require('appdev/jquery/jqueryex');

// Add jQuery to the global namespace, aliased by $ and jQuery
var global = require('appdev/global');
global.$ = global.jQuery = jQuery;

// Include steal simulation
var steal = require('appdev/jquery/steal');
// Include the JavascriptMVC model and class libraries ($.Model(...) and $.Class(...))
steal('jquery/model', 'jquery/model/backup', 'jquery/model/cache');

module.exports = jQuery;
