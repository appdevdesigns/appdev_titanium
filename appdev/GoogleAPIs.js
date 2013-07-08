var AD = require('AppDev');

module.exports = {
    client_id: AD.Defaults.GoogleAPISecrets.client_id,
    client_secret: AD.Defaults.GoogleAPISecrets.client_secret,
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    get access_token() {
        return AD.PropertyStore.get('access_token');
    },
    set access_token(new_access_token) {
        AD.PropertyStore.set('access_token', new_access_token);
    },
    get refresh_token() {
        return AD.PropertyStore.get('refresh_token');
    },
    set refresh_token(new_refresh_token) {
        AD.PropertyStore.set('refresh_token', new_refresh_token);
    }
};
