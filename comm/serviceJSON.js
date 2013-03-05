// v1.0
// 
// serviceJSON.js
//
// our Service JSON objects provide a mechanism for determinining if a 
// viewer's login authentication has expired and then requiring them to 
// re-authenticate before continuing on with the request.
// 
//

var AD = require('AppDev');
var $ = require('jquery');

var ServiceJSON = {
    // An arry of requests that are delayed because a necessary authentication
    waitingRequests: [],
    
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

        // Automatically fail if the login window is open and the request is not a login request
        if (AD.winLogin.isOpen() && options.url !== AD.Defaults.serverBaseURL+'/service/site/login/authenticate') {
            // Delay this request until the authentication completes
            ServiceJSON.waitingRequests.push(options);
            return;
        }

        var xhr = Ti.Network.createHTTPClient();
        xhr.onload = function() {
            // Called when the request returns successfully
            
            // Convert the response text to a JSON object
            var data = JSON.parse(this.responseText);
            
            if ($.isFunction(options.complete)) {
                // Call the complete callback if it was provided
                options.complete();
            }
            
            // Got a JSON response but was the service action a success?
            if (data.success && (data.success !== 'false')) {
                // SUCCESS!
                if ($.isFunction(options.success)) {
                    // Execute the optional success callback
                    options.success(data);
                }
                return;
            }
            // FAILED
            else {
                var errorID = data.errorID;
                // Authentication failure (i.e. session timeout)
                if (errorID == 55) {
                    ServiceJSON.waitingRequests.push(options);
                    
                    // Reauthenticate
                    AD.winLogin.open(function() {
                        // Resend all wating requests
                        Ti.API.log('Resending requests:');
                        ServiceJSON.waitingRequests.forEach(function(request) {
                            ServiceJSON.post(request);
                        });
                        ServiceJSON.waitingRequests = [];
                    });
                    return;
                }
                // Some other error
                else {
                    var showErrors = options.showErrors;
                    
                    // Execute the optional failure callback
                    if ($.isFunction(options.failure)) {
                        options.failure(data);
                        // Turn off showErrors if it wasn't enabled
                        // explicitly.
                        if (!showErrors || showErrors === 'AUTO') {
                            showErrors = 'OFF';
                        }
                    } 
                    // No failure callback given
                    else if (!showErrors || showErrors === 'AUTO') {
                        // Turn on showErrors if it wasn't disabled
                        // explicitly.
                        showErrors = 'ON';
                    }
                    
                    // Display error message if needed
                    if (showErrors === 'ON') {
                        var errorMsg = data.error || 'Error';
                        alert(errorMSG);
                    }
                    return;
                }
            } // failed
        };
        xhr.onerror = function() {
            // Called when the request returns an error (this should be very rare and signifies a major network error)
            var error = 'JSON request to "'+options.url+'" failed.';
            Ti.API.error(error);
            if ($.isFunction(options.failure)) {
                options.failure(error);
            }
        };
        xhr.open('POST', options.url);
        xhr.setRequestHeader('accept', 'application/json');
        xhr.setRequestHeader('content-type', 'application/json');
        xhr.send(JSON.stringify(options.params));
        return xhr;
    
    } // post
    
}; // ServiceJSON

module.exports = ServiceJSON;
