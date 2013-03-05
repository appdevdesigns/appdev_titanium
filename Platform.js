// Maps OS names from Ti.Platform.osname to displayable names
var osMap = {
    'iphone': 'iPhone',
    'android': 'Android'
};
var Platform = module.exports = {
    osName: osMap[Ti.Platform.osname] || 'Unknown',
    isAndroid: Ti.Platform.osname === 'android',
    isiPhone: Ti.Platform.osname === 'iphone',
    isiPad: Ti.Platform.osname === 'ipad',
    is: function(platform) {
        return Platform['is'+platform];
    }
};
Platform.isiOS = Platform.isiPhone || Platform.isiPad; 
