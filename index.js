const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const request = require('request');

const directory = process.env.GITHUB_WORKSPACE
const header = core.getInput('header');
const file = core.getInput('file');
const token = core.getInput('token');
const lerna = core.getInput('lerna');
const lernaJson = core.getInput('lerna-json');
var lernaJsonParsed;
var lernaLocations = [];


if (lerna) {
  lernaJsonParsed = JSON.parse(lernaJson);
  if (lernaJsonParsed) {
    for (object in lernaJsonParsed) {
      let location = object.location;
      location = location.substring(location.indexOf("${github.context.payload.repository.name}") + str.length("${github.context.payload.repository.name}") + 1);
      lernaLocations.push()
    }
  }
}

var changed = undefined;
var headerFound = undefined;
var json;

function callback(error, response, body) {
  json = JSON.parse(body);

  if(lerna) {
    var errors = "";
    var changedLocal = false;
    var headerFoundLocal = false;
    for (fileLocation in lernaLocations) {
      for (item in JSON.parse(body)) {
        var object = json[item];
        if (object.filename.toString().includes(fileLocation + "/" + file)) {
          changedLocal = true;
          var contents = fs.readFileSync(fileLocation + "/" + object.filename);
          if (contents.includes(header)) {
            headerFoundLocal = true;
          }
        }
      }
  
      if (changedLocal == true && changed != false) {
        changed == true;
      } else if (changedLocal == false) {
        changed == false;
        errors = errors + `The changelog was not changed in this pull request for ${fileLocation}.\n`;
      }

      if (headerFoundLocal == true && headerFound != false) {
        headerFound == true;
      } else if (headerFoundLocal == false) {
        headerFound == false;
        errors = errors + `The changelog has changed in ${fileLocation}, but the required header is missing.\n`;
      }
    }

    core.setOutput('changed', changed.toString());
    core.setOutput('header', headerFound.toString());

    if (changed == false || headerFound == false) {
      const err = new Error(errors);
      err.stack = "";
      throw err;
    }

  } else {
    for (item in JSON.parse(body)) {
      var object = json[item];
      if (object.filename.toString().includes(file)) {
        changed = true;
        var contents = fs.readFileSync(directory + "/" + object.filename);
        if (contents.includes(header)) {
          headerFound = true;
        }
      }
    }

    core.setOutput('changed', changed.toString());
    core.setOutput('header', headerFound.toString());

    if (changed == false) {
      const err = new Error("The changelog was not changed in this pull request.");
      err.stack = "";
      throw err;
    } else if (headerFound == false) {
      const err = new Error("The changelog has changed, but the required header is missing.");
      err.stack = "";
      throw err;
    }
  }
}

try {
  const reqUrl = `https://api.github.com/repos/${github.context.payload.repository.full_name}/pulls/${github.context.payload.pull_request.number}/files`;

  const reqOptions = {
    url: reqUrl,
    method: 'GET',
    headers: {
      'User-Agent': 'Check-Changelog-Action',
      'Authorization': `Bearer ${token}`
    }
  };

  request(reqOptions, callback);

} catch (error) {
  core.setFailed(error.message);
}
