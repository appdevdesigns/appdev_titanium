var AD = require('AppDev');
var $ = require('jquery');

var HTTP = {
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
            HTTP.removeRetryingRequest(request);
        };
        request.failure = function() {
            failed = true;
        };
        request.complete = function() {
            // Retry the next request (or this one if it failed)
            console.log('Completed delayed request to ['+request.url+']!');
            if (failed) {
                // Wait before retrying this request
                setTimeout(HTTP.retryRequests, HTTP.retryDelay);
            }
            else {
                // Retry the next request immediately
                HTTP.retryRequests();
            }
        };
        HTTP.retryingRequests.push(request);
        HTTP.retryingRequestsStore.flush();
    },
    removeRetryingRequest: function(requestOptions) {
        // The request completed, so remove it from the list of retrying requests
        var index = HTTP.retryingRequests.indexOf(requestOptions);
        if (index === -1) {
            console.error('Could not find request in HTTP.retryingRequests!');
            console.log(JSON.stringify(requestOptions));
        }
        else {
            HTTP.retryingRequests.splice(index, 1);
            HTTP.retryingRequestsStore.flush();
        }
    },

    // Retry waiting requests
    retryRequests: function() {
        var requestCount = HTTP.retryingRequests.length;
        if (requestCount === 0) {
            // There are no requests in the retryingRequests array, so nothing is needed here
            setTimeout(HTTP.retryRequests, HTTP.retryDelay);
            return;
        }
        console.log(requestCount+' requests in retryingRequests queue.');
        var request = HTTP.retryingRequests[0];
        console.log('Retrying request to ['+request.url+']...');
        HTTP.post(request);
    },

    // Convert a URL and a query object to a url that includes a querystring
    makeURL: function(baseURL, query) {
        var queryParts = [];
        for (var key in query) {
            queryParts.push(key+'='+encodeURIComponent(query[key]));
        }
        var querystring = queryParts.join('&');
        return baseURL + (querystring ? ('?'+querystring) : '');
    },

    /**
     * @class AppDev.Comm.HTTP.request()
     * @parent AD.HTTP
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
        options.HTTP = {
            onComplete: function() {
                // Call complete AFTER the success or failure callback
                if ($.isFunction(options.complete)) {
                    // Call the complete callback if it was provided
                    options.complete();
                }
            },
            onSuccess: function(response) {
                if ($.isFunction(options.success)) {
                    // Execute the optional success callback
                    options.success(response);
                }
                options.HTTP.onComplete();
            },
            onFailure: function(response) {
                if (options.retry) {
                    // Retry the request until the it succeeds
                    console.log('Request to ['+options.url+'] failed!  Retrying later.');
                    HTTP.addRetryingRequest(options);
                }
                // Execute the optional failure callback
                if ($.isFunction(options.failure)) {
                    options.failure(response);
                }
                options.HTTP.onComplete();
            }
        };

        var url = HTTP.makeURL(options.url, options.query || {});
        if (!/^https?:\/\//.test(options.url)) {
            var serverBaseURL = AD.Defaults.serverBaseURL;
            // Server URL is not specified yet, so ignore this request
            if (!serverBaseURL) {
                onFailure(null);
                return;
            }

            // Add the scheme, domain, and port to this relative URL
            url = serverBaseURL+url;
        }

        var xhr = Ti.Network.createHTTPClient();
        xhr.onload = function() {
            options.HTTP.onSuccess(this.responseText);
        };
        xhr.onerror = function(err) {
            // Called when the request returns an error (the user is probably offline)
            options.HTTP.onFailure(this.responseText);
            console.error('HTTP request to "'+url+'" failed!');
        };
        xhr.open(options.method || 'GET', url);
        $.each(options.headers, function(name, value) {
            xhr.setRequestHeader(name, value);
        });
        xhr.send(options.params);
        return xhr;
    }
};

// Create shortcuts for each of the HTTP verbs
var verbs = {
    get: 'GET',
    post: 'POST',
    put: 'PUT',
    del: 'DELETE',
    head: 'HEAD'
};
$.each(verbs, function(funcName, methodName) {
    HTTP[funcName] = function(options) {
        // Modify the options parameter to include the HTTP method
        return HTTP.request.call(HTTP, $.extend({ method: methodName }, options));
    };
});

AD.Deferreds.login.done(function() {
    // After logging in, initialize request resending
    var requestStore = HTTP.retryingRequestsStore = new AD.FileStore({
        fileName: 'HTTP.retryingRequests.json',
        defaultData: []
    });
    var requests = requestStore.getData();
    requests.forEach(function(request) {
        // Set the retrying property to false because this the request is new and has not been retried yet.
        // Otherwise, the request will be rejected as a duplicate by HTTP.addRetryingRequest.
        request.retrying = false;
        HTTP.addRetryingRequest(request);
    });
    requestStore.setData(HTTP.retryingRequests);

    // Start retrying failed requests
    HTTP.retryRequests();
});

module.exports = HTTP;
