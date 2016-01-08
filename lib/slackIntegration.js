var request = require('request');
var config = require('../config');

var postToSlack = function (msg) {
	var payload = 'payload={"text": "' + msg + '", "channel": "#noc-alerts", "username": "Graphite Monitor Alerts", "icon_emoji": ":cop:"}';

    request.post({
        url: config.slack_url,
        form: payload },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                console.log('Successfully send POST request to Slack\n');
            } else {
                console.log('Server status code: ', response.statusCode);
                console.log(body);
                console.log('An error occurred while sending HTTP POST request to Slack ' + error);
            }
        }
    );
} // postToSlack()

module.exports = postToSlack;