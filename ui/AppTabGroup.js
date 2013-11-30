var $ = require('jquery');

module.exports = $.View('AppDev.UI.AppTabGroup', {}, {
    init: function(options) {
        // Create the tab group
        var tabGroup = Ti.UI.createTabGroup();
        this._super({view: tabGroup});
    },
    
    // Create the tab group's tabs
    create: function() {
        this.options.windows.forEach(function(windowModule) {
            // Create the tab that will be associated with the window
            var tab = Ti.UI.createTab();
            
            // Load the window's module, and create a new window instance
            var Window = require('ui/'+windowModule);
            var $window = new Window({tab: tab});
            var window = $window.getWindow();
            
            // Assumes that window class names are in the format App???Window
            var matches = /^App(\w+)Window$/.exec(windowModule);
            var icon = matches ? '/images/'+matches[1].toLowerCase()+'.png' : null;
            
            // Add the window to the tab and at the tab to the tab group
            tab.window = window;
            tab.title = window.title;
            tab.icon = icon;
            this.view.addTab(tab);
        }, this);
    },
    
    // Open the tab group
    open: function() {
        this.view.open();
    },

    // Close the tab group
    close: function() {
        this.view.close();
    },
    
    // Return the currently focused tab
    getActiveTab: function() {
        return this.view.activeTab;
    }
});
