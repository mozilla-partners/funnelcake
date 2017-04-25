'use strict';

let pageMod = require('sdk/page-mod');

let { flowManager } = require('../flow-manager.js');
let { storageManager } = require('../storage-manager.js');

exports.aboutNewTab = {
    aboutNewtab: undefined,
    /**
     * Stops this pageMod from making more modifications on about:newtab in future
     */
    destroy: function() {
        if (this.aboutNewtab) {
            this.aboutNewtab.destroy();
        }
    },
    /**
     * Modifies the about:newtab page to show a onboarding notification
     */
    modifyAboutNewtab: function() {
        this.aboutNewtab = pageMod.PageMod({
            include: /about:newtab/,
            contentScriptFile: './js/about-newtab.js',
            contentStyleFile: './css/about-newtab.css',
            attachTo: 'top',
            onAttach: function(worker) {
                let intervalTimerStartTime = storageManager.get('intervalTimerStartTime');
                let isSnippetInProgress = typeof storageManager.get('snippetInProgress') !== 'undefined';

                // only call flow manager if we are not in an active interval, and there is
                // not a snippet currently in progress
                if (typeof intervalTimerStartTime === 'undefined') {
                    flowManager.manageFlow(worker);
                }

                // if there is no snippet in progress, then this is the first time
                // onAttach has been fired for this particular snippet so
                if (!isSnippetInProgress) {
                    // we store an indicator to avoid multiple calls to manageFlow
                    storageManager.set('snippetInProgress', true);
                }
            }
        });
    }
};
