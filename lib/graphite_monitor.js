var request = require('request');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var events = require('../events');

/*
    GraphiteMonitor Constructor
*/
function GraphiteMonitor (opts) {
    EventEmitter.call(this);
    this.name = '';
    this.description = '';
    this.severity = ''; // 'Warning', 'High', 'Critical'
    this.graphiteJSONUrl = '';
    this.graphitePNGUrl = '';
    this.typeOfCheck = ''; // SPIKE, RANGE, DROP
    this.metricValue = { target: [], value: [], timestamp: [] };
    this.thresholdForAlert = { spike: 0, drop: 0, range: {min: 0, max: 0} };
    this.timeoutInMinutesForNextAlert = 30; // in minutes
    this.interval = 5; // an interval between HTTP request
    //this.wildcardMetrics = false;
    this.runbookUrl = '';
    this.errorsCount = 0;
    this.alertsCount = 0;
    this.updatesCount = 0;

    // interval handler
    this.handle = null;

    // initialize the app
    this.init(opts);
}

/*
    Inherit from EventEmitter
*/
util.inherits(GraphiteMonitor, EventEmitter);

/*
    Methods
*/

GraphiteMonitor.prototype.init = function (opts) {
        var name = opts.name;
        var graphiteJSONUrl = opts.graphiteJSONUrl;
        var graphitePNGUrl = opts.graphitePNGUrl;
        var typeOfCheck = opts.typeOfCheck;
        var thresholdForAlert = opts.thresholdForAlert;
        var timeoutInMinutesForNextAlert = opts.timeoutInMinutesForNextAlert || 30;
        var interval = opts.interval || 5;
        //var wildcardMetrics = opts.wildcardMetrics || false;

        this.on('error', events.onError);
        this.on('stop', events.onStop);
        this.on('alert', events.onAlert);

        this.name = name;
        this.description = opts.description;
        this.severity = opts.severity;
        this.graphiteJSONUrl = graphiteJSONUrl;
        this.graphitePNGUrl = graphitePNGUrl;
        this.typeOfCheck = typeOfCheck;
        this.thresholdForAlert = thresholdForAlert;
        this.timeoutInMinutesForNextAlert = timeoutInMinutesForNextAlert;
        this.interval = (interval * (60 * 1000));
        //this.wildcardMetrics = wildcardMetrics;

        this.errorsCount = 0;
        this.alertsCount = 0;

        this.alertedTime = null;
        this.alertedDatapoint = null;
        this.alertedDatasource = '';

        this.onTimeout = false;

        this.report = {
            metricName: '',
            alertSeverity: '',
            metricDescription: '',
            alertTimestamp: '',
            alertedDatapoint: '',
            definedThreshold: '',
            graphURL: '',
            alertedDatasources: []
        };

        // Detect user input errors
        var msg = '';
        if (!name) {
            msg = 'You did not specify a name for the metric';
            this.stop(msg);
            return this.emit('error', name, msg);
        }
        if (!graphiteJSONUrl) {
            msg = 'You did not specify an URL to JSON data for the metric';
            this.stop(msg);
            return this.emit('error', name, msg);
        }
        if (!graphitePNGUrl) {
            msg = 'You did not specify an URL to the Graph for the metric';
            this.stop(msg);
            return this.emit('error', name, msg);
        }
        if (!typeOfCheck) {
            msg = 'You did not specify type of the check for the metric';
            this.stop(msg);
            return this.emit('error', name, msg);
        }
        if (!thresholdForAlert[typeOfCheck.toLocaleLowerCase()] && thresholdForAlert[typeOfCheck.toLocaleLowerCase()] != 0 
                          && typeOfCheck.toLocaleLowerCase() != 'range') {
            msg = 'You did not specify threshold conditions for the metric ' + name;
            this.stop(msg);
            return this.emit('error', name, msg);
        }
        if (typeOfCheck.toLocaleLowerCase() === 'range') {
            if ( 
                (!thresholdForAlert[typeOfCheck.toLocaleLowerCase()].min && thresholdForAlert[typeOfCheck.toLocaleLowerCase()].min != 0)
                && (!thresholdForAlert[typeOfCheck.toLocaleLowerCase()].max && thresholdForAlert[typeOfCheck.toLocaleLowerCase()].max != 0) 
                ) {
                     msg = 'You incorrectly specified threshold conditions or type of the check for the metric: ' + name;
                     this.stop(msg);
                     return this.emit('error', name, msg);
            }
        }

        // start monitoring
        this.start();

        return this;
    }, // init()

GraphiteMonitor.prototype.start = function () {
        var self = this;
        var time = Math.floor(Date.now() / 1000);  // unix timestamp in seconds from 1970

        console.log("\nLoading... " + self.name + "\nTime: " + self.getFormatedDate(time));

        // initiate the first check before starting timer for loading starting value
        self.update();
        // create an interval for GET requests
        self.handle = setInterval(function () {
            self.update();
        }, self.interval);

        return self;
    }, // start()

GraphiteMonitor.prototype.update = function () {
        var self = this;
        var currentTime = Date.now();

        // do not send alert multiple times, only after defined timeout
        if (this.alertedTime) {
            var timeDiff = (new Date().getTime() - this.alertedTime.getTime()) / (60 * 1000); // time difference between two dates in minutes
            if (timeDiff < this.timeoutInMinutesForNextAlert) {
                this.onTimeout = true;
                return; // do nothing
            } else {
                // reset key variables
                this.alertedTime = null;
                this.onTimeout = false;
            }
        }

        self.updatesCount++;
        try {
            // send request
            request({
                url: self.graphiteJSONUrl
                }, 
                function (error, res, body) {
                // Server responded correctly
                if (!error && res.statusCode === 200) {
                    self.processData(JSON.parse(body));  // Parse JSON WARNING: SYNCHRONOUS CALL
                }
                // Loading error
                else {
                    self.emit('error', self.name, error);
                    self.errorsCount++;
                }
            });
        } // try
        catch (err) {
            self.emit('error', self.name, err);
            self.errorsCount++;
        }
        return self;
}, // update()


GraphiteMonitor.prototype.processData = function (jsonObj) {
    var self = this;

        if (this.typeOfCheck === 'SPIKE') {
            //this.checkForSpikes();
            this.checkData(jsonObj, function (value) {return value > self.thresholdForAlert.spike});
        } else if (this.typeOfCheck === 'DROP') {
            //this.checkForDrops();
            this.checkData(jsonObj, function (value) {return value < self.thresholdForAlert.drop});
        } else if (this.typeOfCheck === 'RANGE') {
            //this.checkInRange();
            this.checkData(jsonObj, function (value) {return !(value > self.thresholdForAlert.range.min && value < self.thresholdForAlert.range.max)});
        }
        return this;
},  // processData()


    /*
        Actual checks for alert conditions
    */

GraphiteMonitor.prototype.checkData = function (jsonObj, alertCondition) {
    var alertedDatasources = [];
    var datasource
    var datapoint;
    var datapointTimestamp;
    for (metricIndex in jsonObj) {
        datasource = jsonObj[metricIndex].target;
        for (datapointIndex in jsonObj[metricIndex].datapoints) {
            datapoint = jsonObj[metricIndex].datapoints[datapointIndex][0];
            datapointTimestamp = jsonObj[metricIndex].datapoints[datapointIndex][1];
            // sanity check
            if (!datapoint && datapoint !=0) {
                // do nothing if the returned metric is null
                continue;
            }
            if (alertCondition(datapoint)) {
                this.alertedTime = this.getFormatedDate(datapointTimestamp);
                this.alertedDatapoint = datapoint;
                this.alertedDatasource = datasource;
                alertedDatasources.push({
                    datasource: datasource,
                    datapoint: datapoint,
                    timestamp: this.getFormatedDate(datapointTimestamp)
                });
                // this ensures that the same datasources won't be included several times
                break;
            }
        }
    }
    if (alertedDatasources.length > 0) {
        // generate the report object to send
        this.report.metricName = this.name;
        this.report.alertSeverity = this.severity;
        this.report.metricDescription = this.description;
        this.report.alertTimestamp = this.alertedTime;
        this.report.alertedDatapoint = this.alertedDatapoint;
        this.report.definedThreshold = JSON.stringify(this.thresholdForAlert);
        this.report.graphURL = this.graphitePNGUrl;
        this.report.alertedDatasources = alertedDatasources;
        // Sending notifications
        this.emit('alert', this);
    }
},


GraphiteMonitor.prototype.getEmailReport = function () {
       var msg = '';
       msg += '<p>Metric name: ' + this.report.metricName + '<br>';
       msg += 'Alert Severity: ' + this.report.alertSeverity + '<br>';
       msg += 'Metric Description: ' + this.report.metricDescription + '<br>';
       msg += 'Timestamp (MSK): ' + this.report.alertTimestamp + '<br>';
       msg += 'Graph URL: ' + '<a href="' + this.report.graphURL + '">' + this.report.metricName + '</a>' +'<br>';
       msg += '<br>Reported Datasources: <br>';
       for (i in this.report.alertedDatasources) {
            msg += '' + this.report.alertedDatasources[i].datasource + '<br>';
            msg += '' + this.report.alertedDatasources[i].datapoint + '<br>';
            msg += '' + this.report.alertedDatasources[i].timestamp + '<br>';
            msg += '<br>';
       }
       msg += '</p>';
       return msg;
}, // getEmailReport

GraphiteMonitor.prototype.getSlackReport = function () {
       var msg = '';

       msg += 'Metric name: *' + this.report.metricName + '*\n';
       msg += 'Alert Severity: ' + this.report.alertSeverity + '\n';
       msg += 'Metric Description: ' + this.report.metricDescription + '\n';
       msg += 'Timestamp (MSK): ' + this.report.alertTimestamp + '\n\n';
       //msg += 'Threshold: ' + JSON.stringify(this.thresholdForAlert) + '\n\n';
       //msg += 'Graph URL: <' + this.report.graphURL.replace(/&/, '&amp;'); + '|Graph URL>' + '\n\n';
       msg += 'Reported Datasources: \n';
       for (i in this.report.alertedDatasources) {
            msg += '' + this.report.alertedDatasources[i].datasource + '\n';
            msg += '' + this.report.alertedDatasources[i].datapoint + '\n';
            msg += '' + this.report.alertedDatasources[i].timestamp + '\n';
            msg += '\n';
       }
       return msg;
},

GraphiteMonitor.prototype.getFormatedDate = function (unixTimestamp) {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000;
        var dateObj = new Date(unixTimestamp * 1000 - tzoffset); // Multiple on 1000 to get miliseconds from unix timestamp
        var timeAsStr = dateObj.toISOString().slice(0,-1);

        timeAsStr = timeAsStr.replace(/T/, ' ');
        timeAsStr = timeAsStr.replace(/\..+/,'');
        return timeAsStr;
    }, // getFormatedDate()

GraphiteMonitor.prototype.stop = function () {
        this.emit('stop', this.name, this.description, this.graphitePNGUrl, this);
        return this;
    } // stop()

module.exports = GraphiteMonitor;