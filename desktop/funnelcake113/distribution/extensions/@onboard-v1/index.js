'use strict';

let prefService = require('sdk/preferences/service');
let tabs = require('sdk/tabs');

let { aboutNewTab } = require('lib/content-scripts/about-newtab.js');
let { flowManager } = require('lib/flow-manager.js');
let { gaUtils } = require('lib/ga-utils.js');
let { intervals } = require('lib/intervals.js');
let { newtabUtils } = require('lib/newtab-utils.js');
let { scheduler } = require('lib/scheduler.js');
let { storageManager } = require('lib/storage-manager.js');
let { utils } = require('lib/utils.js');

/**
 * This is called when the add-on is unloaded. If the reason is either uninstall,
 * disable or shutdown, we can do some cleanup.
 */
exports.onUnload = function(reason) {
    if (reason === 'uninstall' || reason === 'disable') {
        aboutNewTab.destroy();
    } else if (reason === 'shutdown') {
        // do cleanup, or save state
    }
};

/**
* Initializes the add-on
*/
exports.main = function() {
    let activeTabURL = tabs.activeTab.url;
    let detroyAddon = storageManager.get('destroyAddon');
    let durationTimerStartTime = storageManager.get('durationTimerStartTime');
    let intervalTimerStartTime = storageManager.get('intervalTimerStartTime');
    let installTime = storageManager.get('installTime');
    let lastStep = storageManager.get('step');
    let timeElapsedSinceLastLaunch = Date.now() - installTime;
    let variation = prefService.get('distribution.variation');

    // if destroyAddon is true
    if (detroyAddon) {
        // destroy the pageMod as the tour is complete.
        aboutNewTab.destroy();
        return;
    }

    storageManager.set('variation', variation);

    // if installTime is undefined, this is the first launch of Firefox
    if (typeof installTime === 'undefined') {
        storageManager.set('installTime', Date.now());
        // the first time the add-on is run, the mainTourComplete status
        // will not be set. Initialize it to false.
        storageManager.set('mainTourComplete', false);
        // start a 24 hour timer for this session
        scheduler.startFirstSnippetTimer();
    }

    // post first run
    if (typeof installTime !== 'undefined') {
        // the user has the not seen any of the notifications
        if (typeof durationTimerStartTime === 'undefined' && typeof intervalTimerStartTime === 'undefined') {
            // the user closed the browser before the first snippet timer ran out
            if (timeElapsedSinceLastLaunch < intervals.oneDay) {
                // calculate how much of the first snippet interval remain
                let firstSnippetIntervalRemainder = intervals.oneDay - timeElapsedSinceLastLaunch;
                // if the remainder is greater than a minute
                if (firstSnippetIntervalRemainder > intervals.oneMinute) {
                    // start the first snippet timer for the remainder
                    scheduler.startFirstSnippetTimer(firstSnippetIntervalRemainder);
                } else {
                    // listen for new tabs
                    utils.tabListener();
                }
            // if on launch, the active tab is about:newtab and 24+ hours have elapsed since first launch
            } else if (activeTabURL === 'about:newtab' && timeElapsedSinceLastLaunch >= intervals.oneDay) {
                // inject our tour snippet
                aboutNewTab.modifyAboutNewtab();
                // record an impression
                gaUtils.impressionCount();
            // if on launch, the active tab is not about:newtab but, 24+ hours have elapsed since first launch
            } else if (!activeTabURL !== 'about:newtab' && timeElapsedSinceLastLaunch >= intervals.oneDay) {
                // start a new tab listener
                utils.tabListener();
            }
        // if the durationTimerStartTime is not undefined
        } else if (typeof durationTimerStartTime !== 'undefined') {
            let durationRemaining = intervals.oneDay - (Date.now() - durationTimerStartTime);
            // if the duration left is more than a minute
            if (durationRemaining > intervals.oneMinute) {
                // restart the timer for the remainder
                scheduler.startSnippetDurationTimer(durationRemaining);
                // start the tabListener
                utils.tabListener();
                // call the session counter
                utils.browserSessionCounter();
            } else {
                // store the last snippet in the missedSnippets array
                newtabUtils.updateMissedSnippets(lastStep);
                // progress tour
                flowManager.setOverallTourProgress();
                // ensure that any timers in storage is reset
                scheduler.resetStoredTimers();
                // start an interval timer
                scheduler.startSnippetIntervalTimer();
            }
        // if the intervalTimerStartTime is not undefined, we should start it with the time remaining
        } else if (typeof intervalTimerStartTime !== 'undefined') {
            let intervalRemaining = intervals.oneDay - (Date.now() - intervalTimerStartTime);
            // if the interval timer has not run out
            if (intervalRemaining > intervals.oneMinute) {
                // restart the timer for the remainder
                scheduler.startSnippetIntervalTimer(intervalRemaining);
            } else {
                utils.resetState();
                utils.tabListener();
            }
        }
    }
};
