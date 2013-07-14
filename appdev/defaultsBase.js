var defaults = {
    application: Ti.App.name,
    dbName: Ti.App.name,
    development: Ti.App.deployType === 'development' || Ti.App.deployType === 'test',
    alwaysEncrypt: false, // may be overridden by applications 
    Model: {
        // Model definitions reference the connection type by the key, NOT the value!!!
        ConnectionTypes: {
            local: 'local',
            server: 'server',
            synced: 'synced'
        },
        defaultConnectionType: 'synced' // may be overridden by applications
    },
    localStorageEnabled: true, // may be overridden by applications
    get serverStorageEnabled() {
        return defaults.syncEnabled; // may be overridden by applications
    },
    languageKey: 'en',
    get serverBaseURL() {
        return Ti.App.Properties.getString('server_url_preference');
    },
    get syncEnabled() {
        return Ti.App.Properties.getBool('sync_enabled_preference');
    },
    viewerId: 1,
    // Attempt to load the application-specific GoogleAPISecrets
    GoogleAPISecrets: require('GoogleAPISecrets'),
    feedbackAddress: 'appdev.feedback@gmail.com',
    version: Ti.App.version
};

console.log(defaults.syncEnabled ? 'Syncing to '+defaults.serverBaseURL : 'Sync disabled');

module.exports = defaults;
