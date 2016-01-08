var config = require('./config');
var mailer = require('./lib/mailer');
var slackIntegraion = require('./lib/slackIntegration');

/*
    Event Handlers
*/
    
/*
    Handles events emitted when monitoring of the metric was stopped or interrupted 
*/
function onStop (name, description, graphitePNGUrl, self) {
    "use strict";

    clearInterval(self.handle);
    self.handle = null;

    console.log(name + ' monitor has stopped');
    mailer({
        from: config.GmailAuth.email,   
        to: config.sendToAddress,  
        subject: name + ' monitor has stopped',   
        body: '<p>' + name + ' is no longer being minitored.</p>' 
               + '<p>Metric description: ' + description + '</p>'
               + '<p>URL: ' + graphitePNGUrl + '</p>' + '<br>'
               + '<p>Please forward this message to ilya.khadykin@sperasoft.com for further investigation or try to restart the monitor</p>',
        monitor: self
    });
}

/*
    Handles events emitted when an alert condition is met and alert should be sent
*/
function onAlert (self) { //function onAlert (report, self) 
    "use strict";
    var emailSubject = '';
    
    if (this.report.alertedDatasources.length == 1) {
        emailSubject = this.name + ' | ' + this.alertedDatasource + ' - (current value: ' + this.alertedDatapoint + '; threshold: ' + JSON.stringify(this.thresholdForAlert) + ') | ' + this.alertedTime;
    } else {
        emailSubject = this.name + ' | ' + this.alertedDatasource + ' - (current value: ' + this.alertedDatapoint + '; threshold: ' + JSON.stringify(this.thresholdForAlert) + ') | ' + 
            + this.report.alertedDatasources.length + ' other violations | ' + this.alertedTime;
    }
    // sending email notification
    console.log(emailSubject);
    mailer({
            from: config.GmailAuth.email,
            to: config.sendToAddress, 
            subject: emailSubject,
            body: this.getEmailReport(),  // passing generated html message of the report used as email body
            monitor: self  // passing a refence to a GraphiteMonitor instance
    });
    // send notification to Slack
    slackIntegraion(this.getSlackReport());
}


/*
    Handles events emitted when aa error occurs
    @param - (String) msg - response message  
*/
function onError (metricName, msg) {
    "use strict"; 
    console.log('ERROR' + ' | ' + metricName + ' | ' + msg); 
}


module.exports.onStop = onStop;
module.exports.onAlert = onAlert;
module.exports.onError = onError;