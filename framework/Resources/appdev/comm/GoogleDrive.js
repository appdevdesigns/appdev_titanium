var AD = require('AppDev');
var $ = require('jquery');
var GoogleAPIs = AD.Comm.GoogleAPIs;

var GoogleDrive = module.exports = {};

GoogleDrive.request = function(options) {
    // Determine whether this is a Google APIs request
    var googleAPIsRequest = options.url.indexOf('https://www.googleapis.com/') === 0;

    AD.Comm.HTTP.request({
        method: options.method,
        url: options.url,
        query: options.query,
        headers: $.extend({
            Authorization: 'Bearer '+GoogleAPIs.access_token
        }, options.headers),
        form: options.data,
        success: function(response, xhr) {
            if ($.isFunction(options.success)) {
                options.success(response, xhr);
            }
        },
        failure: function(response, xhr) {
            if (googleAPIsRequest && !options.retryingAccessToken && xhr.status === 401) {
                // The access_token has probably expired, so get a new access code and retry the request
                console.log('Refreshing expired access_token...');
                options.retryingAccessToken = true;
                GoogleDrive.getAccessToken(true, function() {
                    GoogleDrive.request(options);
                });
            }
            else if ($.isFunction(options.failure)) {
                options.failure(response, xhr);
            }
            console.error('Request to '+options.url+' failed!');
            console.error(response);
        }
    });
};

// Get an access code from Google
GoogleDrive.getAuthorizationCode = function(callback) {
    var GoogleAuthWindow = require('ui/GoogleAuthWindow');
    var $winGoogleAuth = new GoogleAuthWindow({
        scope: GoogleAPIs.scope
    });
    $winGoogleAuth.getDeferred().done(function(code) {
        callback(code);
    });
};

// Get an access token from Google
GoogleDrive.getAccessToken = function(forceRefresh, callback) {
    if (!forceRefresh && GoogleAPIs.access_token) {
        callback(GoogleAPIs.access_token);
        return;
    }

    var success = function(data) {
        if (data.refresh_token) {
            // Save the refresh_token
            GoogleAPIs.refresh_token = data.refresh_token;
            $.dev.log('refresh_token: '+GoogleAPIs.refresh_token);
        }

        // Pass back the access_token
        GoogleAPIs.access_token = data.access_token;
        $.dev.log('access_token: '+GoogleAPIs.access_token);
        callback(GoogleAPIs.access_token);
    };

    $.dev.log('refresh_token: '+GoogleAPIs.refresh_token);
    if (GoogleAPIs.refresh_token) {
        // Send an HTTP request to get an access token from the refresh token
        GoogleDrive.request({
            method: 'POST',
            url: 'https://accounts.google.com/o/oauth2/token',
            success: success,
            failure: function(response) {
                if (response.error === 'invalid_grant') {
                    // The authorization code has probably been revoked, along with the associated access and refresh tokens.
                    // Force use of new access and refresh tokens, and try again.
                    GoogleAPIs.access_token = null;
                    GoogleAPIs.refresh_token = null;
                    GoogleDrive.getAccessToken(true, callback);
                }
            },
            data: {
                refresh_token: GoogleAPIs.refresh_token,
                client_id: GoogleAPIs.client_id,
                client_secret: GoogleAPIs.client_secret,
                grant_type: 'refresh_token'
            }
        });
    }
    else {
        GoogleDrive.getAuthorizationCode(function(authorization_code) {
            // Send an HTTP request to get the access and refresh tokens
            GoogleDrive.request({
                method: 'POST',
                url: 'https://accounts.google.com/o/oauth2/token',
                success: success,
                data: {
                    code: authorization_code,
                    client_id: GoogleAPIs.client_id,
                    client_secret: GoogleAPIs.client_secret,
                    redirect_uri: GoogleAPIs.redirect_uri,
                    grant_type: 'authorization_code'
                }
            });
        });
    }
};
