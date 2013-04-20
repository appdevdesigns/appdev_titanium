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
    
    // An array of requests that are delayed because a network error (user is offline)
    retryDelay: 1000,
    retryingRequests: [],
    retryingRequestsStore: null, // initialized after login
    addRetryingRequest: function(requestOptions) {
        if (requestOptions.retrying) {
            // This request is already retrying, so do not add it again
            return;
        }
        
        var failed = false;
        var request = $.extend({}, requestOptions);
        request.retrying = true;
        request.success = function() {
            console.log('Successfully completed delayed request to ['+request.url+']!');
            ServiceJSON.removeRetryingRequest(request);
        };
        request.failure = function() {
            failed = true;
        };
        request.complete = function() {
            // Retry the next request (or this one if it failed)
            console.log('Completed delayed request to ['+request.url+']!');
            if (failed) {
                // Wait before retrying this request
                setTimeout(ServiceJSON.retryRequests, ServiceJSON.retryDelay);
            }
            else {
                // Retry the next request immediately
                ServiceJSON.retryRequests();
            }
        };
        ServiceJSON.retryingRequests.push(request);
        ServiceJSON.retryingRequestsStore.flush();
    },
    removeRetryingRequest: function(requestOptions) {
        // The request completed, so remove it from the list of retrying requests
        var index = ServiceJSON.retryingRequests.indexOf(requestOptions);
        if (index === -1) {
            console.error('Could not find request in ServiceJSON.retryingRequests!');
            console.log(JSON.stringify(requestOptions));
        }
        else {
            ServiceJSON.retryingRequests.splice(index, 1);
            ServiceJSON.retryingRequestsStore.flush();
        }
    },
    
    // Retry waiting requests
    retryRequests: function() {
        var requestCount = ServiceJSON.retryingRequests.length;
        if (requestCount === 0) {
            // There are no requests in the retryingRequests array, so nothing is needed here
            setTimeout(ServiceJSON.retryRequests, ServiceJSON.retryDelay);
            return;
        }
        console.log(requestCount+' requests in retryingRequests queue.');
        var request = ServiceJSON.retryingRequests[0];
        console.log('Retrying request to ['+request.url+']...');
        ServiceJSON.post(request);
    },
    
    /**
     * @class AppDev.ServiceJSON.post()
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
    post: function(options) {
        if (!/^\w*:\/\/.+:(?:\d*)/.test(options.url)) {
            // Add the scheme, domain, and port to the relative URL
            options.url = AD.Defaults.serverBaseURL+options.url;
        }
        
        var onload = function(response) {
            // Called when the request returns successfully
            
            // Convert the response text to a JSON object
            var data = JSON.parse(response);
            
            var success = false;
                        
            // Got a JSON response but was the service action a success?
            if (data && data.success && (data.success !== 'false')) {
                // SUCCESS!
                if ($.isFunction(options.success)) {
                    // Execute the optional success callback
                    options.success(data);
                }
                success = true;
            }
            // FAILED
            else {
                // Execute the optional failure callback
                if ($.isFunction(options.failure)) {
                    options.failure(data);
                }
                
                if (options.retry) {
                    // Retry the request until the it succeeds
                    console.log('Request to ['+options.url+'] failed!  Retrying later.');
                    ServiceJSON.addRetryingRequest(options);
                }
                
                // Authentication failure (i.e. session timeout)
                if (data && data.errorID == 55) {
                    ServiceJSON.addWaitingRequest(options);
                    
                    // Reauthenticate
                    AD.winLogin.open(function() {
                        // Resend all waiting requests
                        console.log('Resending requests:');
                        ServiceJSON.waitingRequests.forEach(function(request) {
                            ServiceJSON.post(request);
                        });
                        ServiceJSON.waitingRequests = [];
                    });
                }
            } // failed
            
            // Call complete AFTER the success or failure callback
            if ($.isFunction(options.complete)) {
                // Call the complete callback if it was provided
                options.complete();
            }
            
            return success;
        };
        
        // Automatically fail if the login window is open and the request is not a login request
        if (AD.winLogin && AD.winLogin.isOpen && options.url !== AD.Defaults.serverBaseURL+'/service/site/login/authenticate') {
            if (options.retry) {
                // Treat this request as a failure because it will retry it later
                onload(null);
            }
            else {
                // Delay this request until the authentication completes
                ServiceJSON.addWaitingRequest(options);
            }
            return;
        }
        
        var xhr = Ti.Network.createHTTPClient();
        xhr.onload = function() {
            onload(this.responseText);
        };
        xhr.onerror = function(err) {
            // The server responds with a 401 Unauthorized error if the user is not
            // authenticated, so give the success callback a chance to handle the error
            if (onload(this.responseText)) {
                // onload returned true, so the 'error' was that the user was unauthenticated
                return;
            }
            
            // Called when the request returns an error (this should be very rare and signifies a major network error)
            var errorMessage = 'JSON request to "'+options.url+'" failed.';
            console.error(errorMessage);
        };
        xhr.open('POST', options.url);
        xhr.setRequestHeader('accept', 'application/json');
        xhr.setRequestHeader('content-type', 'application/json');
        xhr.send(JSON.stringify(options.params));
        return xhr;
        
    } // post
    
}; // ServiceJSON

AD.Deferreds.login.done(function() {
    // After logging in, initialize request resending
    var requestStore = ServiceJSON.retryingRequestsStore = new AD.FileStore({
        fileName: 'ServiceJSON.retryingRequests.json',
        defaultData: []
    });
    var requests = requestStore.getData();
    requests.forEach(function(request) {
        // Set the retrying property to false because this the request is new and has not been retried yet.
        // Otherwise, the request will be rejected as a duplicate by ServiceJSON.addRetryingRequest.
        request.retrying = false;
        ServiceJSON.addRetryingRequest(request);
    });
    requestStore.setData(ServiceJSON.retryingRequests);
    
    // Start retrying failed requests
    ServiceJSON.retryRequests();
});

module.exports = ServiceJSON;
