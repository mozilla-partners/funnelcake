'use strict';

let _ = require('sdk/l10n').get;
let { Cu } = require('chrome');
let { emit, on } = require('sdk/event/core');
let self = require('sdk/self');
let tabs = require('sdk/tabs');
let { UITour } = Cu.import('resource:///modules/UITour.jsm');
let windowUtils = require('sdk/window/utils');

let { gaUtils } = require('./ga-utils.js');
let { storageManager } = require('./storage-manager.js');
let { variations } = require('./variations.js');

exports.newtabUtils = {
    /**
     * Loads and returns the requested snippet
     * @param {int} missedStep - The specific previously missed step
     * @returns The processed HTML as a string
     */
    getSnippet: function(missedStep) {
        // 0 evaluates to false in JS so, we check whether the type
        // is a number to determine whether a missedStep was passed
        let isMissedStep = typeof missedStep === 'number';
        let step = storageManager.get('step');
        let snippet = '';

        // if missedStep was not set, use the step from storage
        if (isMissedStep) {
            // Load the missedStep
            snippet = module.exports.newtabUtils.getSnippetHTML(missedStep);
        } else {
            snippet = module.exports.newtabUtils.getSnippetHTML(step);
        }

        // returns the processed HTML string
        return snippet;
    },
    /**
     * Loads the snippet template, calls the process fuction, amd returns
     * the processed HTML as a string.
     * @param {int} step - The current step in the tour
     * @returns The processed HTML as a string
     */
    getSnippetHTML: function(step) {
        let tmpl = self.data.load('./tmpl/snippet.html');
        let variation = variations[storageManager.get('variation')];

        return module.exports.newtabUtils.processTmpl({
            'tmpl': tmpl,
            'topic': variation[step],
            'count': step + 1
        });
    },
    /**
     * @param {string} imgBaseUrl - The base url for the img to load
     * @returns The image' resource:// url
     */
    getImgURL: function(imgBaseUrl) {
        return self.data.url(imgBaseUrl);
    },
    /**
     * Trigger snippet action based on intent
     * @param {string} intent - The intent of the snippet CTA
     */
    handleIntent: function(intent) {

        switch(intent) {
            case 'addons':
                module.exports.newtabUtils.highLight('addons');
                break;
            case 'customize':
                module.exports.newtabUtils.highLight('customize');
                break;
            case 'default_browser':
                module.exports.newtabUtils.setAsDefault();
                break;
            case 'private_browsing':
                module.exports.newtabUtils.highLight('privateWindow');
                break;
            case 'search':
                module.exports.newtabUtils.showSearch();
                break;
            case 'sync':
                tabs.open(_('sync_content_cta_url') + storageManager.get('variation'));
                break;
            default:
                break;
        }

        emit(exports, 'scheduleNextSnippet', intent);
    },
    /**
     * Highlight a given item in the browser chrome
     * @param {string} item - Item you wish to highlight's name as a string
     */
    highLight: function(item) {
        // the browser window object from which we can grab an individual node (like the awesome bar)
        let activeWindow = windowUtils.getMostRecentBrowserWindow();

        UITour.getTarget(activeWindow, item, false).then(function(chosenItem) {
            try {
                UITour.showHighlight(activeWindow, chosenItem, 'wobble');
            } catch(e) {
                console.error('Could not highlight element. Check if UITour.jsm supports highlighting of element passed.', e);
            }
        });
    },
    /**
     * Listens for messages passed to the worker, and calls the handleIntent function
     * @param {object} worker - The worker that receives messages
     */
    listen: function(worker) {
        // intent event is fired when the user clicks the main CTA for the current snippet
        worker.port.on('intent', function(intent) {

            if (intent !== 'dismiss') {
                // record CTA complete
                gaUtils.post('Primary CTA Click');
            }

            module.exports.newtabUtils.handleIntent(intent);
        });
    },
    /**
     * Emits and event to modify about:newtab and starts the event listener
     * @param {object} worker - The worker that receives messages
     * @param {int} missedStep - The specific previously missed step
     */
    modify: function(worker, missedStep) {
        // 0 evaluates to false in JS so, we check whether the type
        // is a number to determine whether a missedStep was passed
        let isMissedStep = typeof missedStep === 'number';
        let tabUtils = module.exports.newtabUtils;
        // emit modify event and pass dismissed snippet HTML as a string
        worker.port.emit('modify', isMissedStep ? tabUtils.getSnippet(missedStep) : tabUtils.getSnippet());
        // listen for messages from about:newtab
        module.exports.newtabUtils.listen(worker);
    },
    /**
     * Processes a HTML tmpl for localisation and returns the result
     * @param {object} tmplData - The data for the template. Contains three items:
     * 1. tmpl - The template HTML as a string
     * 2. topic - The current snippet i.e. sync, addons etc.
     * 3. count - The current step count
     */
    processTmpl: function(tmplData) {
        let regex = /%[\w]+/;
        let resultsArray = [];

        while ((resultsArray = regex.exec(tmplData.tmpl)) !== null) {
            let imgResourceURL = '';
            let match = resultsArray[0];

            switch(match) {
                case '%count':
                    tmplData.tmpl = tmplData.tmpl.replace(match, tmplData.count);
                    break;
                case '%dismiss_msg':
                    tmplData.tmpl = tmplData.tmpl.replace(match, _('dismiss_msg'));
                    break;
                case '%main_title':
                    tmplData.tmpl = tmplData.tmpl.replace(match, _('main_title'));
                    break;
                case '%icon':
                    // if the match is for the string %icon, this is a media item
                    // so we need to get the full resource:// url to inject into the tmpl
                    imgResourceURL = module.exports.newtabUtils.getImgURL(
                        _(tmplData.topic + '_' + match.substr(1)));
                    tmplData.tmpl = tmplData.tmpl.replace(match, imgResourceURL);
                    break;
                default:
                    // replaces the matched template string with the localised string
                    tmplData.tmpl = tmplData.tmpl.replace(match, _(tmplData.topic + '_' + match.substr(1)));
                    break;
            }
        }

        return tmplData.tmpl;
    },
    /**
     * Remove highlighting from current UITour element(s)
     */
    removeHighlight: function() {
        // the browser window object from which we can grab an individual node (like the awesome bar)
        let activeWindow = windowUtils.getMostRecentBrowserWindow();
        UITour.hideHighlight(activeWindow);
    },
    /**
     * Prompts the user to set Firefox as their default brower.
     */
    setAsDefault: function() {
        let activeWindow = windowUtils.getMostRecentBrowserWindow();
        UITour.setConfiguration(activeWindow, 'defaultBrowser');
    },
    /*
     * Opens the search bar
     */
    showSearch: function() {
        // the browser window object from which we can grab an individual node (like the awesome bar)
        let activeWindow = windowUtils.getMostRecentBrowserWindow();
        let barPromise = UITour.getTarget(activeWindow, 'search');
        let iconPromise = UITour.getTarget(activeWindow, 'searchIcon');

        iconPromise.then(function(iconObj) {
            let searchIcon = iconObj.node;
            searchIcon.click();

            barPromise.then(function(barObj) {
                let searchbar = barObj.node;
                searchbar.updateGoButtonVisibility();
            });
        });
    },
    /**
     * Maintains the list of missed snippets.
     * @param {int} snippetIndex - The array index of the missed snippet
     */
    updateMissedSnippets: function(snippetIndex) {
        let missedSnippets = storageManager.get('missedSnippets') || [];
        // push the new snippetIndex onto the array
        missedSnippets.push(snippetIndex);
        // store the new array
        storageManager.set('missedSnippets', missedSnippets);
    }
};

exports.onNewtabUtilsEvent = on.bind(null, exports);
