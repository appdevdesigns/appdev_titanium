var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.StringPromptWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            createParams: {
                layout: 'vertical'
            },
            title: 'stringPromptTitle',
            focusedChild: 'string',
            autoOpen: true,
            modal: true
        });
    },
    
    // Create child views
    create: function() {
        this.add('infoLabel', Ti.UI.createLabel({
            top: 10,
            left: 10,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.small,
            textid: 'stringPromptInfo'
        }));
        this.add('string', Ti.UI.createTextField({
            top: 10,
            left: 10,
            width: AD.UI.useableScreenWidth,
            height: 30,
            font: AD.UI.Fonts.small,
            autocorrect: false,
            autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE,
            borderStyle: Titanium.UI.INPUT_BORDERSTYLE_ROUNDED
        }));
        var doneButton = this.add('done', Ti.UI.createButton({
            top: 10,
            center: {x: AD.UI.screenWidth / 2},
            width: 80,
            height: AD.UI.buttonHeight,
            titleid: 'done'
        }));
        var _this = this;
        doneButton.addEventListener('click', function(event) {
            _this.dfd.resolve(_this.getChild('string').value);
        });
    }
});
