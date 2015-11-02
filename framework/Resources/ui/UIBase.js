// Load several essential framework UI components
// Note that UI components that create classes in the AD.UI namespace cannot be loaded here because AD.UI has not been assigned yet
require('ui/View');
require('ui/Window');
require('ui/ModelTable');

var AD = require('AppDev');
var $ = require('jquery');

var UI = module.exports = {
    get screenWidth() {
        return Ti.Platform.displayCaps.platformWidth / Ti.Platform.displayCaps.logicalDensityFactor;
    },
    get screenHeight() {
        return Ti.Platform.displayCaps.platformHeight / Ti.Platform.displayCaps.logicalDensityFactor;
    },
    get useableScreenWidth() {
        return UI.screenWidth - UI.padding * 2;
    },
    
    buttonHeight: 40,
    textFieldHeight: 40,
    
    padding: 10,
    
    Fonts: {
        small: {fontSize: 12},
        mediumSmall: {fontSize: 15},
        medium: {fontSize: 18},
        large: {fontSize: 24},
        header: {fontWeight: 'bold', fontSize: 24}
    },
    
    systemBlueColor: '#516691',
    
    $winError: null,
    displayError: function(options) {
        console.log('Displaying error:');
        console.log(JSON.stringify(options));
        if (UI.$winError && UI.$winError.isOpen) {
            // Close the existing error window
            UI.$winError.close();
        }
        UI.$winError = new AD.UI.ErrorWindow(options);
        UI.$winError.getDeferred().always(function() {
            // Set $winError to null when the window is closed
            UI.$winError = null;
        });
    }
};

if (AD.Platform.isAndroid) {
    // Convert pixels to dips on Android
    UI.screenWidth /= Ti.Platform.displayCaps.logicalDensityFactor;
    UI.screenHeight /= Ti.Platform.displayCaps.logicalDensityFactor;
}

// Log display info for debugging purposes
console.log('Display info:');
['platformWidth', 'platformHeight', 'xdpi', 'ydpi', 'density', 'logicalDensityFactor', 'dpi'].forEach(function(key) {
    var value = Ti.Platform.displayCaps[key];
    console.log(key+': '+value+' ['+(typeof value)+']');
});
console.log(UI.screenWidth+'x'+UI.screenHeight+' dips');

// Create the cancel/edit buttons on the nav bar that allow the user to edit a tableview
UI.enableTableEditing = function(window, table) {
    // Create edit/cancel buttons for nav bar to allow deletion of rows
    var edit = Ti.UI.createButton({titleid: 'edit'});
    edit.addEventListener('click', function() {
        window.setLeftNavButton(cancel);
        table.editing = true;
    });
    var cancel = Ti.UI.createButton({
        titleid: 'cancel',
        style: Ti.UI.iPhone.SystemButtonStyle.DONE
    });
    cancel.addEventListener('click', function() {
        window.setLeftNavButton(edit);
        table.editing = false;
    });
    table.editable = true;
    window.setLeftNavButton(edit);
};

// Display an alert dialog with the specified message
// The "buttons" parameter is an array of button names
// Return a deferred promise that will be resolved to the index of the clicked button
UI.alert = function(message, buttons) {
    var dfd = $.Deferred();
    var dlg = Ti.UI.createAlertDialog({
        message: AD.localize(message), // allow message to refer to a string in the localization file
        buttonNames: buttons.map(AD.localize)
    });
    dlg.addEventListener('click', function(event) {
        dfd.resolve(event.index);
    });
    dlg.show();
    return dfd.promise();
};

// Shortcut for creating an OK alert dialog
UI.okAlert = function(message, resolveValue) {
    return UI.alert(message, ['ok']).pipe(function(button) {
        // Allow the caller to specify the value that the deferred will be resolved with
        return typeof resolveValue === 'undefined' ? button : resolveValue;
    });
};

// Display a yes/no alert dialog
// Return a deferred promise that will be resolved to true if "yes" was clicked and rejected to false if "no" was clicked
UI.yesNoAlert = function(message) {
    var dfd = $.Deferred();
    UI.alert(message, ['yes', 'no']).done(function(button) {
        if (button === 0) {
            dfd.resolve(true);
        }
        else if (button === 1) {
            dfd.reject(false);
        }
    });
    return dfd.promise();
};

// Request access to the user's address book if necessary
// Return a deferred that will be resolved when granted authorization and rejected when denied authorization
UI.requestContactsAuthorization = function() {
    var authorizeDfd = $.Deferred();
    if (Ti.Contacts.contactsAuthorization === Ti.Contacts.AUTHORIZATION_AUTHORIZED) {
        authorizeDfd.resolve();
    }
    else if (Ti.Contacts.contactsAuthorization === Ti.Contacts.AUTHORIZATION_UNKNOWN) {
        Ti.Contacts.requestAuthorization(function(e) {
            if (e.success) {
                authorizeDfd.resolve();
            }
            else {
                authorizeDfd.reject();
            }
        });
    }
    else {
        authorizeDfd.reject();
        alert(AD.localize('contactsUnauthorized'));
    }
    return authorizeDfd.promise();
};

// Return the dimensions of image scaled to fit within a box of the specified dimensions, maintaining a constant aspect ratio
UI.getImageScaledDimensions = function(image, maxDimensions) {
    var scaleX, scaleY;
    var maximize = '';
    if (maxDimensions.width && !maxDimensions.height) {
        maximize = 'width';
    }
    else if (!maxDimensions.width && maxDimensions.height) {
        maximize = 'height';
    }
    else if (maxDimensions.width && maxDimensions.height) {
        scaleX = maxDimensions.width / image.width;
        scaleY = maxDimensions.height / image.height;
        maximize = scaleX < scaleY ? 'width' : 'height';
    }
    if (maximize === 'width') {
        // width must be maximized
        scaleX = maxDimensions.width / image.width;
        return {
            width: maxDimensions.width,
            height: image.height * scaleX
        };
    }
    else if (maximize === 'height') {
        // height must be maximized
        scaleY = maxDimensions.height / image.height;
        return {
            width: image.width * scaleY,
            height: maxDimensions.height
        };
    }
};

// Return an array of Ti.UI.TableViewSection instances derived from rows, an array of Ti.UI.TableViewRow instances
// It is assumed that the rows are already sorted
// sectionGenerator is a callback to calculate the section name of a row.  It is called with a
// single parameter, the row, and should return the string representation of the row's section name.
// For example:
/**
 * var sectionGenerator = function(row) {
 *     // Return the first character of the rows title
 *     return row.title[0];
 * };
 */
UI.rowsToSections = function(rows, sectionGenerator) {
    // Break the table rows into sections
    var sections = [];
    var currentSection = {rows: []};
    var previousRow = null;
    rows.forEach(function(row) {
        if (previousRow) {
            var previousSectionKey = sectionGenerator(previousRow);
            var currentSectionKey = sectionGenerator(row);
            if (previousSectionKey !== currentSectionKey) {
                // This model belongs in a new section
                currentSection.title = previousSectionKey;
                sections.push(currentSection);
                currentSection = {title: currentSectionKey, rows: []};
            }
        }
        currentSection.rows.push(row);
        previousRow = row;
    });
    sections.push(currentSection);
    
    // Create TableViewSections for each of the sections
    var tableViewSections = sections.map(function(section) {
        var tableViewSection = Ti.UI.createTableViewSection({
            headerTitle: section.title
        });
        section.rows.forEach(function(row) {
            tableViewSection.add(row);
        });
        return tableViewSection;
    });
    return tableViewSections;
};
