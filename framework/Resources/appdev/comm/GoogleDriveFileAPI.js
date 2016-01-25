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
        var contentType = fileData.metadata.mimeType || 'application/octet-stream';
        
        var base64Data = AD.Base64.encode(fileData.content);
        var multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(fileData.metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n' +
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
    },
    list: function(folderId, callback) {
        var query = 'trashed = false';
        if (folderId) {
            query += ' and \''+folderId+'\' in parents';
        }
        AD.Comm.GoogleDrive.request({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v2/files',
            query: {
                q: query
            },
            success: function(response) {
                callback(response.items);
            }
        });
    }
};
