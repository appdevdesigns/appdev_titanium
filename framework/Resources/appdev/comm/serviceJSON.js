// v1.0
//
// serviceJSON.js
//
// our Service JSON objects provide a mechanism for determining if a
// viewer's login authentication has expired and then requiring them to
// re-authenticate before continuing on with the request.
//
//

var AD = require('AppDev');
var $ = require('jquery');

var ServiceJSON = {
    // An array of requests that are delayed because of a necessary authentication
    waitingRequests: [],
    addWaitingRequest: function(request) {
        // Do not add the request to the pending requests list if it is set to retry automatically on failure
        if (!request.retry) {
            ServiceJSON.waitingRequests.push(request);
        }
    },
    
    /**
     * @class AppDev.ServiceJSON.request()
     * @parent AD.serviceJSON
     * Post an Ajax request asynchronously.
     *
     * @param string options.url
     *    The URL to post the request to.
     * @param object options.params
     *    An associative array of field names and values to post.
     * @param function options.complete
     *    The callback function to execute after the request is completed,
     *    before checking whether or not it succeeded or failed.
     * @param function options.success
     *    The callback function to execute if the request is successful.
     * @param function options.failure
     *    The callback function to execute if the request failed.
     * @param string options.showErrors
     *    "ON", "OFF", or "AUTO". Default is AUTO.
     *    Auto means errors will be shown unless a failure callback is
     *    provided.
     */
    request: function(options) {
        var onload = function(response, xhr) {
            // Called when the request returns successfully
            
            // Convert the response text to a JSON object
            var data = null;
            try {
                data = JSON.parse(response);
            }
            catch(err) {
                console.error('Could not parse response as JSON!');
                console.log(response);
            }
            
            // Got a JSON response but was the service action a success?
            if (data && data.success) {
                options.HTTP.onSuccess(response, xhr);
            }
            else if (data && data.errorID === 55) {
                // Authentication failure (i.e. session timeout)
                ServiceJSON.addWaitingRequest(options);
                
                // Reauthenticate
                AD.winLogin.open(function() {
                    // Resend all waiting requests
                    console.log('Resending requests:');
                    ServiceJSON.waitingRequests.forEach(function(request) {
                        ServiceJSON.request(request);
                    });
                    ServiceJSON.waitingRequests = [];
                });
            }
            else {
                // The request failed
                options.HTTP.onFailure(response, xhr);
            }
        };
        
        // Automatically fail if the login window is open and the request is not a login request
        if (AD.winLogin && AD.winLogin.isOpen && options.url !== '/service/site/login/authenticate') {
            if (options.retry) {
                // Treat this request as a failure because it will retry it later
                options.HTTP.onFailure(null, null);
            }
            else {
                // Delay this request until the authentication completes
                ServiceJSON.addWaitingRequest(options);
            }
            return;
        }
        
        return AD.Comm.HTTP.request($.extend(true, {
            params: JSON.stringify(options.params),
            headers: $.extend({
                'accept': 'application/json',
                'content-type': 'application/json'
            }, options.headers),
            success: onload,
            failure: onload
        }, options));
    } // request
    
}; // ServiceJSON

// Add the GET and POST request shortcuts
['get', 'post'].forEach(function(method) {
    ServiceJSON[method] = function(options) {
        return ServiceJSON.request($.extend({
            method: method.toUpperCase()
        }, options));
    };
});

module.exports = ServiceJSON;
