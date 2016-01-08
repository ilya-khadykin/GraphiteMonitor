var http = require('http');
var GraphiteMonitor = require('./lib/graphite_monitor');
var metrics = require('./metrics');
var events = require('./events');
var config = require('./config');

var server;
var monitors = [];

metrics.forEach(function (metric) {
    var monitor = new GraphiteMonitor(metric);

    monitors.push(monitor);
});

// console.log(monitors);

var requestCount = 0;
server = http.createServer(function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var data = '';
    data += '<!DOCTYPE html>'
    data += '<html>'
    data += '<head>'
    data += '    <title>GraphiteMonitor</title>'
    data += '<style>'
    data += 'table, th, td {'
    data += '    border: 1px solid black;'
    data += '    border-collapse: collapse;'
    data += '    background-color: #C8C8C8;'
    data += '    text-align:center;'
    data += '}'
    data += 'th, td {'
    data += '    padding: 15px;'
    data += '}'
    data += '</style>'
    data += '</head>'

    data += '<body>'
    data += "<h1>Monitoring the following metrics...</h1>";
    data += '<table style="width:100%">'
    data += '<tr>'
    data += '  <th>Name</th>'
    data += '  <th>Link to Graphite</th>'
    data += '  <th>Number of updates</th>'
    data += '  <th>Errors occurred</th>'
    data += '  <th>Alerts sent</th>'
    data += '  <th>On hold</th>'
    data += '</tr>'
    monitors.forEach(function (monitor) {
        data += '<tr>'
        data += '<td>' + monitor.name  + '</td>'
        data += '<td>' + '<a href="' + monitor.graphitePNGUrl + '"><<< See the Graph >>></a>' + '</td>'
        data += '<td>' + monitor.updatesCount + '</td>'
        data += '<td>' + monitor.errorsCount  + '</td>'
        data += '<td>' + monitor.alertsCount  + '</td>'
        data += '<td>' + monitor.onTimeout    + '</td>'
        data += '</tr>'
/*        data += '<p>' + monitor.name + ' | ' + monitor.description + '<br>';
        data += '<a href="' + monitor.graphitePNGUrl + '"><<< Graph from Graphite >>></a>' + '<br>';
        data += 'Alerts sent: ' + monitor.alertsCount + ' | '
        data += 'Errors occurred: ' + monitor.errorsCount + ' | '
        data += 'Number of updates: ' + monitor.updatesCount + ' | '
        data += 'On hold: ' + monitor.onTimeout + '</p>';
        data += '<hr>'*/
    });
    data += '</table>'
    data += '<hr>'
    data += 'This page was requested <strong>' + (requestCount / 2).toString() + '</strong> times'
    data += '</body>'
    data += '</html>'
    res.end(data);
    requestCount++;
}); // createServer()

server.listen(config.httpServerPort, config.httpServerIp);
console.log('\nServer is running. Listening to port %s', config.httpServerPort);