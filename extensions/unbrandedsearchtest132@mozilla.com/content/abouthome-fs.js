const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function addNewUpdateDefaultEngineHeader(document, self) {
  return function newUpdateDefaultEngineHeader(n) {
    let header = document.getElementById("contentSearchDefaultEngineHeader");
    header.firstChild.setAttribute("src", self.defaultEngine.icon);
    if (!self._strings) {
      return;
    }
    while (header.firstChild.nextSibling) {
      header.firstChild.nextSibling.remove();
    }
    if (self.defaultEngine.name == "Search") {
      header.appendChild(document.createTextNode(
        "Search"));
    } else {
      header.appendChild(document.createTextNode(
        this._strings.searchHeader.replace("%S", self.defaultEngine.name)));
    }
  }
}

var observer = {
  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "content-document-global-created":
      case "chrome-document-global-created":
        var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        win.addEventListener("load", function(event) {
          win.removeEventListener("load", arguments.callee, false);
          var doc = event.target;
          var url = doc.location.href.split("?")[0].split("#")[0];
          switch (url) {
            case "about:home":
            case "chrome://browser/content/abouthome/aboutHome.xhtml":
              win.setTimeout(function() {
                win.wrappedJSObject.gContentSearchController._updateDefaultEngineHeader = addNewUpdateDefaultEngineHeader(doc, win.wrappedJSObject.gContentSearchController);
              }, 0);
              
              break;
            case "about:newtab":
              win.wrappedJSObject.gSearch._contentSearchController._updateDefaultEngineHeader = addNewUpdateDefaultEngineHeader(doc,win.wrappedJSObject.gSearch._contentSearchController);
              break;
          }
        }, false);
        break;
    }
  }
}
Services.obs.addObserver(observer, "content-document-global-created", false);
Services.obs.addObserver(observer, "chrome-document-global-created", false);

addEventListener("unload", function() {
  Services.obs.removeObserver(observer, "content-document-global-created", false);
  Services.obs.removeObserver(observer, "chrome-document-global-created", false);
});
