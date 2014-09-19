console.log('Service tick');

var killTime = Ti.App.Properties.getInt('killTime');
if (killTime && Date.now() >= killTime * 1000) {
    // It is time to kill the app, so stop the service
    console.log('Stopping service');
    Ti.App.Properties.removeProperty('encryptedPassword');
    Ti.App.Properties.removeProperty('killTime');
    
    var intent = Ti.Android.currentService.getIntent();
    Ti.Android.stopService(intent);
}
