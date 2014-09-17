var AD = require('AppDev');
var $ = require('jquery');

$.Class('AppDev.Comm.CAS', {}, {
    // Request a new service ticket from CAS and return a deferred that will resolve to that ticket
    getServiceTicket: function(username, password, service) {
        var ticketDfd = $.Deferred();
        AD.Comm.HTTP.post({
            url: this.options.casBaseUrl + '/v1/tickets',
            form: {
                username: username,
                password: password
            }
        }).done(function(response, xhr) {
            AD.Comm.HTTP.post({
                url: xhr.getResponseHeader('location'),
                form: {
                    service: service
                }
            }).done(ticketDfd.resolve).fail(ticketDfd.reject);
        }).fail(ticketDfd.reject);
        return ticketDfd.promise();
    }
});
