var syncEnabled = Ti.App.Properties.getBool('sync_enabled_preference');
var syncServerURL = Ti.App.Properties.getString('server_url_preference');
console.log(syncEnabled ? 'Syncing to ['+syncServerURL+']' : 'Sync enabled');
var defaults = {
    application: Ti.App.name,
    dbName: Ti.App.name,
    development: Ti.App.deployType === 'development' || Ti.App.deployType === 'test',
    Model: {
        // Model definitions reference the connection type by the key, NOT the value!!!
        ConnectionTypes: {
            local: 'local',
            server: 'server',
            synced: 'synced'
        },
        defaultConnectionType: syncEnabled ? 'synced' : 'local' // may be overridden by applications
    },
    localStorageEnabled: true, // may be overridden by applications
    serverStorageEnabled: syncEnabled, // may be overridden by applications
    languageKey: 'en',
    serverBaseURL: syncServerURL,
    feedbackAddress: 'appdev.feedback@gmail.com',
    version: Ti.App.version
};

module.exports = defaults;
