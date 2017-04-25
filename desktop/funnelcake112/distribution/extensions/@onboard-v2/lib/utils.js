'use strict';

let { emit, on } = require('sdk/event/core');
let tabs = require('sdk/tabs');

let { aboutNewTab } = require('./content-scripts/about-newtab.js');
let { gaUtils } = require('./ga-utils.js');
let { storageManager } = require('./storage-manager.js');

exports.utils = {
    /**
     * Keeps track of the number of new Firefox sessions. Once the new browser session count
     * reaches 3, we need to reset the counter.
     */
    browserSessionCounter: function() {
        let sessionCounter = storageManager.get('sessionCounter');

        // if sessionCounter does not exist, this is the very first
        // session, initialize to 1
        if (typeof sessionCounter === 'undefined') {
            storageManager.set('sessionCounter', 1);
        // we have completed 3 sessions, this is the first session for the next
        // snippet, reset the sessionCounter to 1
        } else if(parseInt(sessionCounter) === 3) {
            // reset the session counter
            storageManager.set('sessionCounter', 1);
            // emit an even to the scheduler to progress the tour
            // and/or start an intervalTimer
            emit(exports, 'maxSessionCountReached');
        } else {
            // increment the sessionCounter by 1
            storageManager.set('sessionCounter', parseInt(sessionCounter) + 1);
        }
    },
    /**
     * If the tab is about:newtab call modifyAboutNewtab
     * @param {object} tab - The current tab's Tab object
     */
    handleNewTab: function(tab) {
        if (tab.url === 'about:newtab') {
            // remove the current listener
            tabs.off('ready', module.exports.utils.handleNewTab);
            // record an impression
            gaUtils.impressionCount();
            // inject our tour pageMod
            aboutNewTab.modifyAboutNewtab();
        }
    },
    /**
     * Resets the add-on after a timer completes.
     * This means that both timer start times are set to undefined and,
     * mainCTAComplete and snippetDismissed is set to false
     */
    resetState: function() {
        // we are moving on to a new snippet so clear snippetInProgress
        storageManager.set('snippetInProgress', undefined);
        // set intervalTimerStartTime, and durationTimerStartTime to undefined to indicate that
        // these timers are not currently running
        storageManager.set('intervalTimerStartTime', undefined);
        storageManager.set('durationTimerStartTime', undefined);
        // also set both mainCTAComplete and snippetDismissed to false
        storageManager.set('mainCTAComplete', false);
        storageManager.set('snippetDismissed', false);
        // reset browser session counter
        storageManager.set('sessionCounter', 0);
        // reset snippet impression count
        storageManager.set('impressionCount', 0);
    },
    /**
     * Listens for the tabs.open event and triggers the about:newtab pageMod to inject a snippet, if
     * the new tab has a URL of about:newtab
     */
    tabListener: function() {
        // listen for new open tab events
        tabs.on('ready', module.exports.utils.handleNewTab);
    },
};

exports.onUtilsEvent = on.bind(null, exports);
