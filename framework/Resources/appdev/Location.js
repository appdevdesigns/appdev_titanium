module.exports = {
    // Return a deferred object that will resolve to the user's current physical location
    getCurrentLocation: function(purpose, accuracy) {
        Ti.Geolocation.purpose = AD.Localize(purpose);
        Ti.Geolocation.accuracy = accuracy;
        
        var locationDfd = $.Deferred();
        if (Ti.Geolocation.locationServicesEnabled || AD.Platform.isAndroid) {
            // On Android, the passive location provider is always enabled, so attempt
            // to get the current location even if no location services are detected
            Ti.Geolocation.getCurrentPosition(function(e) {
                if (e.success) {
                    locationDfd.resolve(e);
                }
                else if (e.code === Ti.Geolocation.ERROR_DENIED) {
                    // The app has been denied access to location services
                    locationDfd.reject({
                        locationResults: e,
                        message: AD.Localize('locationUnauthorized')
                    });
                }
                else {
                    // An error occurred that we do not know how to handle
                    locationDfd.reject({
                        locationResults: e,
                        message: AD.Localize('locationUnknown')
                    });
                }
            });
        }
        else {
            // Location services are disabled on iOS
            locationDfd.reject({
                locationResults: null,
                message: AD.Localize('locationDisabled')
            });
        }
        return locationDfd.promise();
    }
};
