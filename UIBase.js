// Load several essential framework UI components
// Note that UI components that create classes in the AD.UI namespace cannot be loaded here because AD.UI has not been assigned yet
require('ui/View');
require('ui/Window');
require('ui/ModelTable');

var $ = require('jquery');

module.exports = UI = {
    screenWidth: Ti.Platform.displayCaps.platformWidth,
    screenHeight: Ti.Platform.displayCaps.platformHeight,
    useableScreenWidth: Ti.Platform.displayCaps.platformWidth - 20, // 10 unit padding on each side
    useableScreenHeight: Ti.Platform.displayCaps.platformHeight - 116, // 20 unit status bar, 44 unit navigation bar, 50 unit tab bar
    
    buttonHeight: 30,
    textFieldHeight: 40,
    
    Fonts: {
        small: {fontSize: 12},
        mediumSmall: {fontSize: 15},
        medium: {fontSize: 18},
        large: {fontSize: 24},
        header: {fontWeight: 'bold', fontSize: 24}
    },
    
    systemBlueColor: '#516691'
};

// Create the cancel/edit buttons on the nav bar that allow the user to edit a tableview
UI.enableTableEditing = function(window, table) {
    // Create edit/cancel buttons for nav bar to allow deletion of rows
    var edit = Titanium.UI.createButton({titleid: 'edit'});
    edit.addEventListener('click', function() {
        window.setLeftNavButton(cancel);
        table.editing = true;
    });
    var cancel = Titanium.UI.createButton({
        titleid: 'cancel',
        style: Titanium.UI.iPhone.SystemButtonStyle.DONE
    });
    cancel.addEventListener('click', function() {
        window.setLeftNavButton(edit);
        table.editing = false;
    });
    table.editable = true;
    window.setLeftNavButton(edit);
};

// Display a yes/no alert dialog
// Return a deferred promise that will resolve to true if yes was clicked and false if no was clicked
UI.yesNoAlert = function(message) {
    var dfd = $.Deferred();
    var dlg = Titanium.UI.createAlertDialog({
        message: L(message), // allow message to refer to a string in the localization file
        buttonNames: [L('yes'), L('no')]
    });
    dlg.addEventListener('click', function(ev) {
        if (ev.index === 0) {
            // clicked "Yes"
            dfd.resolve(true); 
        } else if (ev.index === 1) {
            // clicked "No"
            dfd.reject(false);
        }
    });
    dlg.show();
    return dfd.promise();
};

// Return the dimensions of image scaled to fit within a box of the specified dimensions, maintaing a constant aspect ratio
UI.getImageScaledDimensions = function(image, maxDimensions) {
    var maximize = '';
    if (maxDimensions.width && !maxDimensions.height) {
        maximize = 'width';
    }
    else if (!maxDimensions.width && maxDimensions.height) {
        maximize = 'height';
    }
    else if (maxDimensions.width && maxDimensions.height) {
        var scaleX = maxDimensions.width / image.width;
        var scaleY = maxDimensions.height / image.height;
        maximize = scaleX < scaleY ? 'width' : 'height';
    }
    if (maximize === 'width') {
        // width must be maximized
        var scaleX = maxDimensions.width / image.width;
        return {
            width: maxDimensions.width,
            height: image.height * scaleX
        };
    }
    else if (maximize === 'height') {
        // height must be maximized
        var scaleY = maxDimensions.height / image.height;
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
        return Ti.UI.createTableViewSection({
            headerTitle: section.title,
            rows: section.rows
        });
    });
    return tableViewSections;
};
