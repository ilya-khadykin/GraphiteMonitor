# GraphiteMonitor
Monitors metrics on Graphite's instance using preconfigured thresholds (from `metrics.js` file).
[Graphite](https://github.com/graphite-project/graphite-web "Graphite Project on GitHub") is a highly scalable real-time graphing system that offers the Render URL API on wich this app is based on. The initial idea of the app was to automate routine monitoring of critical metrics, instead of watching graphs yourself this app will send an email alert or\and post a message to your Slack chatroom. 
In the current version the app just ignores any network errors or cases when Graphite returns empty response which leads to ignoring the actual data for that time period. It's a flow in logic of the app and I'm going to address it as soon as possible.

## How it works
GraphiteMonitor app will send GET HTTP requests at regular intervals to a Graphite instance and log the results. If the requested metric value is under preconfigured treshold condition an email alert will be sent out. You must provide valid Gmail credentials and other configuration information in `config.js` file as well as infromation of a metrics you are going to monitor with thresholds in `metrics.js` file (see `config.js.example` and `metrics.js.example` to learn used format).

## How to use it
Add your metrics using the folowing example:
```javascript
    {
        name: 'dbc4_cpu_load',  // name of the metric, used in email subjects and UI
        description: 'CPU load for main physical box which hosts SQL Servers',  // more detailed description of the metric
        severity: 'Warning',  // how important the metric is
        graphiteJSONUrl: 'https://url_to_your_graphite instance/render?target=aliasByNode(keepLastValue(sql.processor.Time.dbc4),4)&width=800&height=800&from=-2minute&untill=now&format=json',  // HTTP GET request to that URL should return JSON object with datapoints
        graphitePNGUrl: 'https://url_to_your_graphite instance/render?target=aliasByNode(keepLastValue(sql.processor.Time.dbc4),4)&width=800&height=800&from=-90minute&untill=now',  // HTTP GET request to that URL should return PNG image of the metric, used for email attachments
        typeOfCheck: 'DROP',  // type of check, SUPPORTED TYPES: SPIKE, DROP, RANGE; this is used to determine wich alert condition to use
        thresholdForAlert: { drop: 40 },  // define tresholds for the respective check type - DROP: { drop: 40 }, SPIKE: { spike: 15 }, RANGE: { range: { min: 2, max: 6 } }
        timeoutInMinutesForNextAlert: 5,  // timeout in Minutes until the next alert is sent if the alerting conditions are still met
        interval: 1,  // interval in Minutes, defines how often the metric will be updated
        wildcardmMetrics: false  // is it wildcard or a single metric
    }
```
Here is a 'clean' template for you convenience:
```javascript
    {
        name: '',
        description: '',
        severity: '',
        graphiteJSONUrl: '',
        graphitePNGUrl: '',
        typeOfCheck: '',
        thresholdForAlert: ,
        timeoutInMinutesForNextAlert: 60,
        interval: 5,
        wildcardmMetrics: false
    }
```

## Requirements and Installation
The app is written in javascript on top of node.js platform. It requires the following modules to work:
- request
- util
- events
- http
- nodemailer

Use **npm**, issue the following command in the app`s directory:
```shell
npm install
```
It will automatically install any dependent packages for you.

You can now run the app using the following command iside app's directory:
```shell
node app.js

## To Do
Fixes:
- consider adding 'checkForMissingValues()' function which will check metricValues and ensures that Graphite sent real values rather then 'None'; it can impact other functions code | 2015-12-03
- fix an issue when the monitoring of the metric is stopped to send notification email with additional information and remove the metric from the interface; | 2015-12-04
- fix a logic flow when an error occurs while retrieving data from Graphite or Graphite returns `None` the app never checks that datapoint again, it should try to get that data again | 2016-01-06
New features:
- design the logic for handling high number of errors, what is the threshold, how to stop monitors and alert people about it;
- add logs for common events;
- switch to `Express` as HTTP Server