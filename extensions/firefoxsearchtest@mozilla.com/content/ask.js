const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const kEngineName = "Firefox Search";
const kPrefPrefix = "extensions.firefoxbrandedsearch.";
const kPrefOriginalName = kPrefPrefix + "originalName";

function onLoad(args) {
}

function onAccept() {
  window.arguments[0].addEngine = true;
}
