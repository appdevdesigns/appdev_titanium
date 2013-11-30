var $ = require('jquery');
var AD = require('AppDev');

// Create a generic window class that inheirts from the $.View class
$.View('jQuery.Window', {
    defaults: {
        createParams: {
            backgroundColor: 'white'
        }
    },
    actionShortcuts: {
        cancel: function() {
            // Cancel the task and close the window by rejecting the window's deferred
            this.dfd.reject();
        },
        preferences: function() {
            // Open the Android preferences window
            Ti.UI.Android.openPreferences();
        }
    },
    systemButtons: {
        edit: Ti.UI.iPhone.SystemButton.EDIT,
        cancel: Ti.UI.iPhone.SystemButton.CANCEL,
        done: Ti.UI.iPhone.SystemButton.DONE,
        save: Ti.UI.iPhone.SystemButton.SAVE
    }
}, {
    init: function(options) {
        var _this = this;
        
        // If 'init' is called via this._super(...) in a derived class, make sure that the new options are added to this.options
        $.extend(true, this.options, options);
        this.options.createParams.title = AD.Localize(this.options.title); // can be either a string or a key in the locale file
        
        this.tab = this.tab || this.options.tab || (AD.UI.$appTabGroup && AD.UI.$appTabGroup.getActiveTab());
        
        // Create the window
        var window = this.window = Ti.UI.createWindow(this.options.createParams);
        
        // The window is the view's view
        this._super({ view: this.window });
        
        var leftNavButtons = [];
        var rightNavButtons = [];
        
        // Build a menu on Android and create nav buttons on iOS that correspond to each action
        var hasCloseHandler = false;
        var actions = $.mergeArrays(this.constructor.actions, this.actions, this.options.actions).filter(function(action) {
            var validPlatform = true;
            if (action.platform) {
                // Determine whether this is one of the platforms supported by the action
                validPlatform = action.platform.split('/').reduce(function(validPlatform, platform) {
                    return validPlatform || AD.Platform.is(platform);
                }, false);
            }
            var enabled = true;
            if (typeof action.enabled !== 'undefined') {
                // The enabled property can be a function or a boolean value
                enabled = $.isFunction(action.enabled) ? action.enabled.call(this) : action.enabled;
            }
            return validPlatform && enabled;
        }, this);
        actions.forEach(function(action) {
            // Expand the callback string to a shortcut function, if possible
            var shortcutAction = this.constructor.actionShortcuts[action.callback];
            if (shortcutAction && !this[action.callback]) {
                action.callback = shortcutAction;
            }
            
            // Ensure that inside the callback, 'this' will still refer to the window instance
            var callback = this.proxy(action.callback);
            
            if (AD.Platform.isiOS) {
                var button = {
                    title: action.title,
                    systemButton: action.systemButton,
                    callback: callback
                };
                if (action.leftNavButton === true || ($.isFunction(action.leftNavButton) && action.leftNavButton.call(this))) {
                    leftNavButtons.push(button);
                }
                if (action.rightNavButton === true || ($.isFunction(action.rightNavButton) && action.rightNavButton.call(this))) {
                    rightNavButtons.push(button);
                }
            }
            else if (AD.Platform.isAndroid) {
                if (action.backButton) {
                    window.addEventListener('android:back', callback);
                }
            }
            
            if (action.onClose) {
                if (hasCloseHandler) {
                    console.warn('Window already has close handler!');
                }
                else {
                    // Call the callback when the window is closed
                    hasCloseHandler = true;
                    window.addEventListener('close', callback);
                }
            }
        }, this);
        
        if (AD.Platform.isiOS) {
            this.createNavButtons(rightNavButtons, 'Right');
            this.createNavButtons(leftNavButtons, 'Left');
        }
        
        if (AD.Platform.isAndroid) {
            window.addEventListener('focus', function() {
                // As of Titanium SDK 3.0.0, each window in a tab group shares a common activity.
                // Thus, the Android menu will need to be recreated each time the window changes.
                // See http://developer.appcelerator.com/blog/2012/12/breaking-changes-in-titanium-sdk-3-0.html
                var activity = window.activity;
                if (!activity || !activity.invalidateOptionsMenu) {
                    // This window does not have a real activity associated with it (its "activity" property might
                    // simply be an empty Javascript object), so get the activity from the application tab group
                    var tabGroup = AD.UI.$appTabGroup ? AD.UI.$appTabGroup.getView() : null;
                    activity = tabGroup ? tabGroup.activity : null;
                    if (!activity || !activity.invalidateOptionsMenu) {
                        // If we still cannot find a valid activity, then abort
                        return;
                    }
                }
                activity.onCreateOptionsMenu = function(event) {
                    // When a menu needs to be created in response to a press of the 'menu' button, create a menu item for each action
                    actions.forEach(function(action) {
                        // The menuItem property, if not specified, defaults to true
                        if (action.menuItem !== false) {
                            var menuItem = event.menu.add({ title: AD.Localize(action.title) });
                            menuItem.addEventListener('click', _this.proxy(action.callback));
                        }
                    });
                };
                activity.invalidateOptionsMenu();
            });
        }
        
        // This deferred object represents a possible pending task for the window and
        // will be resolved when the task completes, or rejected if the task is canceled
        this.dfd = $.Deferred();
        
        if (!hasCloseHandler) {
            // The default close handler rejects the deferred
            window.addEventListener('close', this.dfd.reject);
        }
        // Notify the view that the window is being destroyed
        window.addEventListener('close', this.proxy('destroy'));
        
        if (this.options.focusedChild) {
            window.addEventListener('open', this.proxy(function() {
                // Focus the child specified by the focusedChild option
                this.getChild(this.options.focusedChild).focus();
            }));
        }
        
        if (this.options.autoOpen) {
            this.open();
        }
        
        // Close the window after the task is completed or canceled
        this.dfd.always(this.proxy('close'));
    },
    
    // Add buttons to the nav bar on the specied side
    createNavButtons: function(navButtons, side) {
        var navBarView = null;
        if (navButtons.length === 0) {
            return;
        }
        else if (navButtons.length === 1) {
            // Create a button as the nav bar view
            
            var navButton = navButtons[0];
            // Guess what system button this button represents based on its title
            var systemButton = this.constructor.systemButtons[navButton.title];
            var button = navBarView = Ti.UI.createButton({
                title: AD.Localize(navButton.title),
                systemButton: navButton.systemButton || systemButton // will be undefined in some cases
            });
            button.addEventListener('click', navButton.callback);
        }
        else {
            // Create multiple buttons and add them to a button bar as the nav bar view
            var labels = navButtons.map(function(button) { return AD.Localize(button.title); });
            var buttonBar = navBarView = Ti.UI.createButtonBar({
                labels: labels,
                style: Ti.UI.iPhone.SystemButtonStyle.BAR
            });
            buttonBar.addEventListener('click', function(event) {
                var button = navButtons[event.index];
                if (button) {
                    // If the user clicked the button bar, but not a button,
                    // then event.index is null and button will be undefined
                    button.callback();
                }
            });
        }
        
        this.window['set'+side+'NavButton'](navBarView);
    },
    
    isOpen: false,
    
    // Open the window
    open: function() {
        this.isOpen = true;
        if (this.options.modal) {
            this.window.open({
                fullscreen: true
            });
        }
        else if (this.tab) {
            this.tab.open(this.window);
        }
        else {
            this.window.open();
        }
    },
    close: function() {
        this.isOpen = false;
        if (this.tab && !AD.Platform.isAndroid) {
            this.tab.close(this.window, { animated: true });
        }
        else {
            this.window.close();
        }
    },
    
    isWindow: true, // is a member of the $.Window class
    
    // Return the deferred object representing the window's operation
    getDeferred: function() {
        return this.dfd;
    },
    
    // Return the window view
    getWindow: function() {
        return this.window;
    }
});
