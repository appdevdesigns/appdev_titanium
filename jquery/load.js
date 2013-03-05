var jQuery = require('jquery');

// Add other components to jQuery
// These modules will all update the jQuery object defined in jquery.js
require('jquery/jquery-event');
require('jquery/jquery-callbacks');
require('jquery/jquery-deferred');
require('jquery/tiajax');
require('jquery/jqueryex');

// Add jQuery to the global namspace, aliased by $ and jQuery
var global = require('global');
global.$ = global.jQuery = jQuery;

// Include steal simulation
var steal = require('jquery/steal');
// Include the JavascriptMVC model and class libraries ($.Model(...) and $.Class(...))
steal('jquery/model').then('jquery/model/backup', 'jquery/model/cache');

module.exports = jQuery;
