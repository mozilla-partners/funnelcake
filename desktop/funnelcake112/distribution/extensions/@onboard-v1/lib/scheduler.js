'use strict';

let timers = require('sdk/timers');

let { gaUtils } = require('./ga-utils.js');
let { intervals } = require('./intervals.js');
let { onNewtabUtilsEvent } = require('./newtab-utils.js');
let { flowManager, onFlowManagerEvent } = require('./flow-manager.js');
let { storageManager } = require('./storage-manager.js');
let { onUtilsEvent, utils } = require('./utils.js');

let timer;

/**
 * The max session count has been reached, this is the same as
 * the duration expiring so, move the tour forward as needed and
 * start an intervalTimer
 */
onUtilsEvent('maxSessionCountReached', function() {
    flowManager.setOverallTourProgress();
    module.exports.scheduler.startSnippetIntervalTimer();
});

/**
 * Listens for a custom event fired from newtabUtils
 */
onNewtabUtilsEvent('scheduleNextSnippet', function(intent) {
    module.exports.scheduler.scheduleNextSnippet(intent);
});

/**
 * Listens for a custom event fired from flowManager
 */
onFlowManagerEvent('action', function(action) {
    if (action === 'intervalTimer') {
        module.exports.scheduler.startSnippetIntervalTimer();
    } else if (action === 'durationTimer') {
        module.exports.scheduler.startSnippetDurationTimer();
    }
});

exports.scheduler = {
    /**
     * If a snippet timer is currently scheduled, clear it.
     */
    clearSnippetTimer: function() {
        if (timer) {
            module.exports.scheduler.resetStoredTimers();
            timers.clearTimeout(timer);
        }
    },
    /**
     * Resets the timers in storage bu setting their values to undefined
     */
    resetStoredTimers: function() {
        storageManager.set('durationTimerStartTime', undefined);
        storageManager.set('intervalTimerStartTime', undefined);
    },
    /**
    * Updates either snippetDismissed or mainCTAComplete, moves the tour
    * on by one step, and starts a new interval timer.
    * @param {string} intent - Optional, and only valid if the value is dismiss
    */
    scheduleNextSnippet: function(intent) {
        // when this function is called there may be a durationTimer
        // currently running so, we clear any existing timer
        module.exports.scheduler.clearSnippetTimer();

        if (intent === 'dismiss') {
            // store an indicator that the snippet has been dismissed
            storageManager.set('snippetDismissed', true);
            // record dismissed snippet event
            gaUtils.post('Notification Dismissal');
        } else {
            // store that the mainCTA has been completed
            storageManager.set('mainCTAComplete', true);
        }

        flowManager.setOverallTourProgress();
        module.exports.scheduler.startSnippetIntervalTimer();
    },
    /**
    * Starts a timer that will call the utils.tabListener() function after the elapsed wait time,
    * should the user not close the browser earlier.
    * @param {int} duration - The optional remaining duration for which to start the timer
    */
    startFirstSnippetTimer: function(duration) {
        let waitInterval = duration ? duration : intervals.waitInterval;

        timer = timers.setTimeout(function() {
            utils.tabListener();
        }, waitInterval);
    },
    /**
     * A timer started to manage the duration for which the
     * current snippet should be shown.
     * @param {int} duration - The optional remaining duration for which to start the timer
     */
    startSnippetDurationTimer: function(duration) {
        let waitInterval = duration ? duration : intervals.waitInterval;

        module.exports.scheduler.clearSnippetTimer();

        // if no duration is passed, this is a new timer
        if (!duration) {
            // store the time that the timer was started
            storageManager.set('durationTimerStartTime', Date.now());
        }

        timer = timers.setTimeout(function() {
            // set snippet impression count back to 0
            storageManager.set('impressionCount', 0);
            flowManager.setOverallTourProgress();
            module.exports.scheduler.startSnippetIntervalTimer();
        }, waitInterval);
    },
    /**
     * A timer started to manage the interval between the
     * end of the last snippet and the start of the next
     * @param {int} duration - The optional remaining duration for which to start the timer
     */
    startSnippetIntervalTimer: function(duration) {
        let waitInterval = duration ? duration : intervals.waitInterval;

        module.exports.scheduler.clearSnippetTimer();

        // if no duration is passed, this is a new timer
        if (!duration) {
            // store the time that the timer was started
            storageManager.set('intervalTimerStartTime', Date.now());
        }

        timer = timers.setTimeout(function() {
            utils.resetState();
            utils.tabListener();
        }, waitInterval);
    }
};
