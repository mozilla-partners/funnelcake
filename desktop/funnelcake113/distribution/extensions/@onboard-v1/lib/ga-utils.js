'use strict';

let prefService = require('sdk/preferences/service');
let Request = require('sdk/request').Request;
let timers = require('sdk/timers');

let { storageManager } = require('./storage-manager.js');
let { variations } = require('./variations.js');

const hitType = 'event';
const trackingId = 'UA-36116321-22';

exports.gaUtils = {
    /**
     * Gathers and returns data for the current event
     * @param {number} [step] - Optional step passed by missedSnippets
     */
    getEventData: function(missedStep) {
        // because step is an array index, it can be 0 which
        // will evaluate to false inside a conditional
        let isNumber = typeof missedStep === 'number';
        let step = isNumber ? missedStep : parseInt(storageManager.get('step'));
        let variation = storageManager.get('variation');

        return {
            step: 'Step' + (step + 1),
            contentVariation: variation,
            topic: variations[variation][step]
        };
    },
    /**
     * Keeps track of the number of times a snippet has been viewed,
     * and returns the total count
     */
    impressionCount: function() {
        let impressionCount = storageManager.get('impressionCount') || 0;
        // set the new impression count in storage
        storageManager.set('impressionCount', impressionCount + 1);
        // return the new count
        return impressionCount + 1;
    },
    /**
     * Sends post events to Google Analytics about various
     * interactions with the add-on during it's lifecycle.
     * @param {string} label - The event label
     * @param {number} [step] - Optional step passed by missedSnippets
     */
    post: function(label, step) {
        let eventData = module.exports.gaUtils.getEventData(step);

        let gaRequest = Request({
            url: 'https://www.google-analytics.com/collect',
            content: {
                v: 1,
                t: hitType,
                ec: 'Addon Interactions',
                ea: eventData.step,
                el: label,
                cid: storageManager.get('clientId'),
                cd3: eventData.contentVariation,
                cd4: eventData.topic,
                cd5: module.exports.gaUtils.impressionCount(),
                cd8: prefService.get('onboard.environment') || 'test',
                tid: trackingId
            }
        });

        // because of the broken way onAttach behaves, we need an implicit wait here
        // before posting to avoid double/tripple posts for the same event
        timers.setTimeout(function() {
            gaRequest.post();
        }, 5000);
    },
    /**
     * Send a ping to GA on each startup of the browser
     */
    sendStartupGAPing: function() {
        let gaRequest = Request({
            url: 'https://www.google-analytics.com/collect',
            content: {
                v: 1,
                t: hitType,
                ec: 'Firefox Interactions',
                ea: 'Start Browser',
                cid: storageManager.get('clientId'),
                cd3: storageManager.get('variation'),
                cd8: prefService.get('onboard.environment') || 'test',
                tid: trackingId
            }
        });

        gaRequest.post();
    }
};
