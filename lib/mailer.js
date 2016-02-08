var nodemailer = require('nodemailer');
var request = require('request');
var PassThrough = require('stream').PassThrough;
var config = require('../config');
var mailer;

mailer = function (opts) {
    var transporter = nodemailer.createTransport({
        host: config.smtpConfig.host,
        port: config.smtpConfig.port
    });
    
    var nameOfAttachment = opts.monitor.name + ' - ' + opts.monitor.getFormatedDate(Date.now()) + ' screenshot.png';
    var graphitePNGUrlStream = new PassThrough();
    request
         .get({
                 url: opts.monitor.graphitePNGUrl
             })
         .on('error', function(err) {
                 // I should consider adding additional logic for handling errors here
                 console.log(err);
                 nameOfAttachment = 'Error: cannot attach a sreenshot';
                 graphitePNGUrlStream = err
        })
         .pipe(graphitePNGUrlStream);

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: opts.from, // sender address
        to: opts.to, // list of receivers
        subject: opts.subject, // Subject line
        html: opts.body, // html body
        attachments: [
            {
                filename: nameOfAttachment,
                content: graphitePNGUrlStream
            }
        ]
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            opts.monitor.errorsCount++;
            opts.monitor.emit('error', opts.monitor.name, 'Failed to send an email, the following error occurred:\n' + error);
            return -1;
        } else {
            opts.monitor.alertsCount++;
            console.log('\n' + opts.monitor.name + ' | Email was sent: ' + info.response);
            opts.monitor.alertedTime = new Date(); // register the time when the alert was sent to start countdown of the timeout for the next one
        }
    });
}

module.exports = mailer;