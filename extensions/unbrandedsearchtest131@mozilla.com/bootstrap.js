const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const kEngineURL = "chrome://unbrandedsearch/content/mozilla131.xml";

const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};


function searchInitialized() {
  if (Services.search.isInitialized) {
    return;
  }
  return new Promise(resolve => {
    const SEARCH_SERVICE_TOPIC = "browser-search-service";
    Services.obs.addObserver(function observer(subject, topic, data) {
      if (data != "init-complete") {
        return;
      }
      Services.obs.removeObserver(observer, SEARCH_SERVICE_TOPIC);
      resolve();
    }, SEARCH_SERVICE_TOPIC, false);
  });
}

function addEngine() {
  return new Promise(resolve => {
    Services.search.addEngine(kEngineURL, Ci.nsISearchEngine.DATA_XML, null, false, {
      onSuccess: function(engine) {
        Services.search.currentEngine = engine;
        resolve();
      },
      onError: function(aCode) {
        Components.utils.reportError(aCode);
        resolve();
      }
    });
  });
}


function addNewUpdateStateForButton(document) {
  return function newUpdateStateForButton(mousedOverButton) {
    let button = mousedOverButton;

    // Ignore dummy buttons.
    if (button && button.classList.contains("dummy")) {
      button = null;
    }

    // If there's no moused-over button, then the one-offs should reflect
    // the selected button, if any.
    button = button || this.selectedButton;

    if (!button) {
      this.header.selectedIndex = this.query ? 1 : 0;
      if (this.textbox) {
        this.textbox.removeAttribute("aria-activedescendant");
      }
      return;
    }

    if (button.classList.contains("searchbar-engine-one-off-item") &&
        button.engine) {
      let headerEngineText =
        document.getAnonymousElementByAttribute(this, "anonid",
                                                "searchbar-oneoffheader-engine");
      this.header.selectedIndex = 2;
      if (button.engine.name == "Search") {
        headerEngineText.value = "";
      } else {
        headerEngineText.value = button.engine.name;
      }
    } else {
      this.header.selectedIndex = this.query ? 1 : 0;
    }
    if (this.textbox) {
      this.textbox.setAttribute("aria-activedescendant", button.id);
    }
  };
}

function addNewUpdateHeader(document) {
  return function newUpdateHeader() {
    let currentEngine = Services.search.currentEngine;
    let uri = currentEngine.iconURI;
    if (uri) {
      this.setAttribute("src", uri.spec);
    } else {
      // If the default has just been changed to a provider without icon,
      // avoid showing the icon of the previous default provider.
      this.removeAttribute("src");
    }

    let headerText;
    if (currentEngine.name == "Search") {
      headerText = this.bundle.GetStringFromName("searchPlaceholder");
    } else {
      headerText = this.bundle.formatStringFromName("searchHeader",
                                                    [currentEngine.name], 1);
    }
    document.getAnonymousElementByAttribute(this, "anonid", "searchbar-engine-name")
            .setAttribute("value", headerText);
    document.getAnonymousElementByAttribute(this, "anonid", "searchbar-engine")
            .engine = currentEngine;
  };
}

function addNewSetupDescription(document) {
  return function newSetupDescription(aDescriptionElement, aText, aNoEmphasis) {
    if (Services.search.currentEngine.name == "Search") {
          aText = "Search";
    }
    // Get rid of all previous text
    if (!aDescriptionElement) {
      return;
    }
    while (aDescriptionElement.hasChildNodes())
      aDescriptionElement.firstChild.remove();

    // If aNoEmphasis is specified, don't add any emphasis
    if (aNoEmphasis) {
      aDescriptionElement.appendChild(document.createTextNode(aText));
      return;
    }

    // Get the indices that separate match and non-match text
    let search = this.getAttribute("text");
    let tokens = this._getSearchTokens(search);
    let indices = this._getBoundaryIndices(aText, tokens);

    this._appendDescriptionSpans(indices, aText, aDescriptionElement,
                                       aDescriptionElement);
  };
}

function install(aData, aReason) {

}

function uninstall(aData, aReason) {

}

async function startup(aData, aReason) {
  await searchInitialized();
  if (aReason == REASONS.ADDON_ENABLE ||
      aReason == REASONS.ADDON_INSTALL) {
    await addEngine();
  }
  let engine = Services.search.getEngineByName("Search");
  if (!engine) {
    // If the user deleted our engine, don't do anything below
    return;
  }

  Services.mm.loadFrameScript("chrome://unbrandedsearch/content/abouthome-fs.js", true);
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win.document.readyState === "complete") {
      loadIntoWindow(win);
    } else {
      win.addEventListener("load", function() {
        win.removeEventListener("load", arguments.callee, false);
        loadIntoWindow(win);
      });
    }
  }
  Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
  Services.wm.removeListener(windowListener);

  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(win);
  }
}

function loadIntoWindow(window) {
  if (!window || window.document.documentElement.getAttribute("windowtype") != "navigator:browser")
    return;

  let doc = window.document;
    var searchPopup = doc.getElementById("PopupSearchAutoComplete");
    searchPopup.updateHeader = addNewUpdateHeader(doc);
    var oneoffs = doc.getAnonymousElementByAttribute(searchPopup, "anonid", "search-one-off-buttons");
    oneoffs._updateStateForButton = addNewUpdateStateForButton(doc);
    var urlbarPopup = doc.getElementById("PopupAutoCompleteRichResult");
    urlbarPopup.addEventListener("popupshowing", function(event) {
          for (let item of this.richlistbox.childNodes) {
            if (item.collapsed) {
              break;
            }
            let url = item.getAttribute("url");
            if (url) {
              let action = item._parseActionUrl(url);
              if (action && action.type == "searchengine") {
                item._setUpDescription = addNewSetupDescription(doc);
              }
            }
          }
      }, false);
    oneoffs = doc.getAnonymousElementByAttribute(urlbarPopup, "anonid", "one-off-search-buttons");
    oneoffs._updateStateForButton = addNewUpdateStateForButton(doc);

    var contextMenu = doc.getElementById("contentAreaContextMenu");
    contextMenu.addEventListener("popupshowing", function cps(event) {
      let menuitem = doc.getElementById("context-searchselect");
      menuitem.label = menuitem.label.replace("Search Search", "Search");
    }, false);
}

function unloadFromWindow(window) {
  var doc = window.document;
  if (!window || doc.documentElement.getAttribute("windowtype") != "navigator:browser")
    return;
}

var windowListener = {
  onOpenWindow: function(window) {
    let domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  onCloseWindow: function(window) {
    let domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface( Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  },
  onWindowTitleChange: function(window) {}
};
