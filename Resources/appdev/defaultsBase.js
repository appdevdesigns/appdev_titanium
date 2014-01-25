var defaults = {
    application: Ti.App.name,
    dbName: Ti.App.name,
    development: Ti.App.deployType === 'development',
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
    get languageKey() {
        var currentLanguage = Ti.Locale.currentLanguage;
        return defaults.supportedLanguages.indexOf(currentLanguage) === -1 ? defaults.defaultLanguage : currentLanguage;
    },
    supportedLanguages: ['en', 'zh-Hans'], // may be overridden by applications
    defaultLanguage: 'en',
    get serverBaseURL() {
        return Ti.App.Properties.getString('server_url_preference');
    },
    get syncEnabled() {
        return Ti.App.Properties.getBool('sync_enabled_preference');
    },
    viewerId: 1,
    // Attempt to load the application-specific GoogleAPISettings
    GoogleAPISettings: require('GoogleAPISettings'),
    feedbackAddress: 'appdev.feedback@gmail.com',
    version: Ti.App.version
};

console.log(defaults.syncEnabled ? 'Syncing to '+defaults.serverBaseURL : 'Sync disabled');

console.log('Current language: '+defaults.languageKey);

module.exports = defaults;
