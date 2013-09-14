var AD = require('AppDev');
var $ = require('jquery');
var GoogleAPIs = require('appdev/GoogleAPIs');

module.exports = $.Window('AppDev.UI.GoogleDriveChooseFileWindow', {
    actions: [{
        title: 'choose',
        callback: function() {
            var dfd = this.getDeferred();
            if (this.options.type === 'file') {
                if (this.folder.fileId) {
                    // A file has been chosen
                    dfd.resolve(this.folder.fileId);
                }
                else {
                    // No file has been chosen
                    alert(AD.Localize('chooseFile'));
                }
            }
            else if (this.options.type === 'folder') {
                // Select the current folder
                dfd.resolve(this.folder.id);
            }
        },
        rightNavButton: true,
        backButton: true
    }, {
        title: 'back',
        callback: 'exit',
        leftNavButton: true
    }, {
        title: 'cancel',
        callback: 'cancel'
    }],
    defaults: {
        folder: 'root',
        type: 'file'
    }
}, {
    init: function(options) {
        this.folder = null; // the current folder
        this.folders = []; // the hierarchy of the current folder

        // Initialize the base $.Window object
        this._super({
            title: 'googleDrive',
            autoOpen: true
        });
    },

    // Create the child views
    create: function() {
        var _this = this;

        var itemsTable = this.add('items', Ti.UI.createTableView({
            data: null
        }));
        itemsTable.addEventListener('click', function(event) {
            var row = event.rowData;
            if (row.hasChild) {
                // Enter the selected folder
                _this.enter({
                    id: row.id,
                    title: row.title,
                    items: null
                });
            }
            else if (_this.options.type === 'file') {
                // Unselect the other files
                var rows = itemsTable.data[0].rows;
                rows.forEach(function(row) {
                    row.hasCheck = false;
                });

                // Select the file
                _this.folder.fileId = row.id;
                event.row.hasCheck = true;
            }
        });
    },

    // Initialize the child views
    initialize: function() {
        // Enter the root folder
        this.enter({
            id: this.options.folder,
            title: AD.Localize(this.options.title),
            items: null
        });
    },

    // Enter the specified folder
    enter: function(folder) {
        // Save the current state
        this.folders.push(this.folder);

        this.folder = folder;
        this.update();
    },
    // Exit the current folder
    exit: function() {
        if (this.folders.length <= 1) {
            // This is the last folder, so close the window
            this.dfd.reject();
            return;
        }

        // Restore the previous state
        this.folder = this.folders.pop();

        this.update();
    },

    // Update the window to represent the current folder
    update: function() {
        var _this = this;
        var itemsDfd = $.Deferred();
        if (this.folder.items) {
            // The items have already been retrieved
            itemsDfd.resolve(this.folder.items);
        }
        else {
            // Query GoogleDrive to get the file items
            AD.Comm.GoogleDriveFileAPI.list(this.folder.id, itemsDfd.resolve);
        }
        itemsDfd.done(function(items) {
            _this.getWindow().title = _this.folder.title;
            _this.folder.items = items;
            _this.getChild('items').data = items.map(function(child) {
                return {
                    title: child.title,
                    id: child.id,
                    hasChild: child.mimeType === 'application/vnd.google-apps.folder',
                    hasCheck: false
                };
            });
        });
    }
});
