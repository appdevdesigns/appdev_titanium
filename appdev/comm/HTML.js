var $ = require('jquery');
var HTML = module.exports = {};

// unimplemented:
// uri, qs, multipart, followRedirect, followAllRedirects, maxRedirects,
// encoding, pool, proxy, oauth, strictSSL, jar
HTML.request = function(options) {
    var headers = options.headers || {};
    var data = null;
    if (options.body) {
        data = options.body;
    }
    else if (options.form) {
        // Send as query string encoded
        data = options.form;
    }
    else if (options.json) {
        // Send as JSON encoded
        data = JSON.stringify(options.json);
    }
    return $.ajax({
        url: options.url,
        type: options.method, // defaults to GET
        data: data,
        headers: options.headers,
        timeout: options.timeout
    });
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
    HTML[funcName] = function(options) {
        // Modify the options parameter to include the HTTP method
        return HTML.request.call(this, $.extend({ method: methodName }, options));
    };
});
