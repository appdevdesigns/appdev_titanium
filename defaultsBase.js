var defaults = {
    application: Ti.App.name,
    dbName: Ti.App.name,
    development: Ti.App.deployType === 'development' || Ti.App.deployType === 'test',
    Model: {
        // Model definitions reference the connection type by the key, NOT the value!!!
        ConnectionTypes: {
            local: 'local',
            server: 'server',
            both: 'both'
        },
        defaultConnectionType: 'server' // may be overridden by applications
    },
    localStorageEnabled: false, // should be overridden by applications
    serverStorageEnabled: false, // should be overridden by applications
    languageKey: 'en',
    serverBaseURL: Ti.App.Properties.getString('server_URL_preference') || 'http://localhost:8088',
    feedbackAddress: 'appdev.feedback@gmail.com',
    version: Ti.App.version
};

module.exports = defaults;
