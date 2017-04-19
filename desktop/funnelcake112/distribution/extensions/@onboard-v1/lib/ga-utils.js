'use strict';

let Request = require('sdk/request').Request;
let timers = require('sdk/timers');

let { storageManager } = require('./storage-manager.js');
let { variations } = require('./variations.js');

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
                t: 'event',
                ec: 'Addon Interactions',
                ea: eventData.step,
                el: label,
                cid: '35009a79-1a05-49d7-b876-2b884d0f825b',
                cd3: eventData.contentVariation,
                cd4: eventData.topic,
                cd5: module.exports.gaUtils.impressionCount(),
                tid: 'UA-36116321-22'
            }
        });

        // because of the broken way onAttach behaves, we need an implicit wait here
        // before posting to avoid double/tripple posts for the same event
        timers.setTimeout(function() {
            gaRequest.post();
        }, 5000);
    }
};
