var AD = require('AppDev');
var $ = require('jquery');

var FeedbackWindow = $.Window('AppDev.UI.FeedbackWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: $.formatString('feedbackTitle', AD.Defaults.application),
            tab: this.options.tab,
            autoOpen: true,
            createParams: {
                layout: 'vertical'
            }
        });
    },

    // Create the child views
    create: function() {
        var _this = this;
        var textFont = {fontSize: 14};
        this.add(Ti.UI.createLabel({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: textFont,
            text: $.formatString('feedbackText', AD.Defaults.application, AD.Defaults.version, AD.Platform.osName, Ti.Platform.version)
        }));
        this.add(Ti.UI.createLabel({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: textFont,
            color: 'red',
            textid: 'feedbackWarning'
        }));
        
        // Create the suggestions and bug report buttons
        var buttonPadding = AD.UI.padding * 2;
        var buttonWidth = AD.UI.screenWidth / 2 - buttonPadding - AD.UI.padding;
        var $buttonView = this.add($.View.create(Ti.UI.createView({
            top: AD.UI.padding * 2,
            left: buttonPadding,
            right: buttonPadding,
            height: AD.UI.buttonHeight
        })));
        var suggestionsButton = $buttonView.add(Ti.UI.createButton({
            top: 0,
            left: 0,
            width: buttonWidth,
            height: AD.UI.buttonHeight,
            titleid: 'suggestion'
        }));
        suggestionsButton.addEventListener('click', function(event) {
            _this.feedback({
                titleId: 'suggestion',
                templateId: 'suggestionTemplate'
            });
        });
        var bugReportButton = $buttonView.add(Ti.UI.createButton({
            top: 0,
            right: 0,
            width: buttonWidth,
            height: AD.UI.buttonHeight,
            titleid: 'bugReport'
        }));
        bugReportButton.addEventListener('click', function(event) {
            _this.feedback({
                titleId: 'bugReport',
                templateId: 'bugReportTemplate',
                formatValues: [AD.Defaults.version, AD.Platform.osName, Ti.Platform.version]
            });
        });
    },
    
    // Display an email dialog to allow the user to give feedback
    feedback: function(templateData) {
        // Localize the title
        var title = AD.Localize(templateData.titleId);
        var formatValues = [AD.Defaults.application];
        if (templateData.formatValues) {
            formatValues = formatValues.concat(templateData.formatValues);
        }
        var emailDialog = Ti.UI.createEmailDialog({
            toRecipients: [AD.Defaults.feedbackAddress],
            subject: $.formatString('feedbackSubject', AD.Defaults.application, title.toLowerCase()), 
            messageBody: $.formatString.apply($, [templateData.templateId].concat(formatValues))
        });
        emailDialog.open();
    }
});

module.exports = $.Window('AppDev.UI.AppInfoWindow', {
    actions: [{
        title: 'preferences',
        callback: function() {
            // Open the Android preferences window
            Ti.UI.Android.openPreferences();
        },
        platform: 'Android'
    }]
}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: 'infoTitle',
            tab: this.options.tab
        });
    },

    // Create the child views
    create: function() {
        var tab = this.options.tab;
        var $contentView = this.add($.View.create(Ti.UI.createScrollView({
            left: 0,
            top: 0,
            width: Ti.UI.SIZE,
            height: Ti.UI.SIZE,
            layout: 'vertical',
            scrollType: 'vertical',
            contentHeight: 'auto',
            showVerticalScrollIndicator: true
        })));
        $contentView.add(Ti.UI.createLabel({
            top: AD.UI.padding * 3,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.header,
            textAlign: 'center',
            text: AD.Defaults.application
        }));
        $contentView.add(Ti.UI.createLabel({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.UI.Fonts.small,
            textAlign: 'center',
            text: $.formatString('aboutVersion', AD.Defaults.version)
        }));
        var feedbackButton = $contentView.add(Ti.UI.createButton({
            top: AD.UI.padding * 2,
            center: {x: AD.UI.screenWidth / 2},
            width: 120,
            height: AD.UI.buttonHeight,
            titleid: 'feedback'
        }));
        feedbackButton.addEventListener('click', function(templateData) {
            // Display the feedback window
            var winFeedback = new FeedbackWindow({ tab: tab });
        });
        $contentView.add(Ti.UI.createLabel({
            top: AD.UI.padding * 2,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: Ti.UI.SIZE,
            font: AD.Platform.isAndroid ? AD.UI.Fonts.small : AD.UI.Fonts.mediumSmall,
            text: $.formatString('aboutLicense', AD.Defaults.application).replace(/\n\n/g, '\n').trim()
        }));
    }
});
