var AD = require('AppDev');

module.exports = {
    read: function(fileId, callback) {
        AD.Comm.GoogleDrive.request({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v2/files/'+fileId,
            success: function(file) {
                // Now download the file content
                AD.Comm.GoogleDrive.request({
                    method: 'GET',
                    url: file.downloadUrl,
                    raw: true,
                    success: function(content) {
                        callback(content, file);
                    }
                });
            }
        });
    },
    write: function(fileData, callback) {
        var boundary = 'boundary';
        var delimiter = '\r\n--' + boundary + '\r\n';
        var closeDelimiter = '\r\n--' + boundary + '--';

        // The blob returned by base64encode has linbreaks
        // (\r\n) in it for some reason, so strip them out
        var base64Data = Ti.Utils.base64encode(fileData.content).text.replace(/\r\n/g, '');
        var multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(fileData.metadata) +
            delimiter +
            'Content-Type: application/octet-stream\r\n' +
            'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +
            base64Data +
            closeDelimiter;
        AD.Comm.GoogleDrive.request({
            method: 'POST',
            url: 'https://www.googleapis.com/upload/drive/v2/files',
            headers: {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            query: {
                uploadType: 'multipart',
            },
            data: multipartRequestBody,
            success: callback
        });
    }
};
