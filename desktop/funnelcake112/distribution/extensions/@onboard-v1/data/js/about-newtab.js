'use strict';

(function() {
    let documentRoot = document.documentElement;
    /**
     * Handles click events on the main CTA and emits the intent
     */
    function emitCTAIntent() {
        let cta = document.getElementById('onboarding_cta');
        let onboardingCloseSnippet = document.getElementById('onboarding_close_snippet');
        let onBoardingTour = document.getElementById('fx_onboarding_tour');

        cta.addEventListener('click', function(event) {
            event.preventDefault();

            // remove the current snippet
            documentRoot.removeChild(onBoardingTour);

            self.port.emit('intent', cta.dataset.intent);
        });

        onboardingCloseSnippet.addEventListener('click', function() {
            // remove the current snippet
            documentRoot.removeChild(onBoardingTour);
            // inform the add-on that the snippet has been dismissed
            self.port.emit('intent', 'dismiss');
        });
    }

    /**
     * listen for the modify event emitted from the add-on, and only then,
     * start executiion of the code.
     * @param {object} data - An object containing the template and page titles.
     */
    self.port.on('modify', function(data) {
        let onBoardingTour = document.getElementById('fx_onboarding_tour');

        // if the onboarding tour element exists, first remove it from the DOM
        if (onBoardingTour) {
            documentRoot.removeChild(onBoardingTour);
        }

        // insert the new snippet
        documentRoot.insertAdjacentHTML('beforeend', data);
        // listen for a click event on the main CTA
        emitCTAIntent();
    });
})();
